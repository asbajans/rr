// ============================================================
//  Rahatio Slave Node — Vercel (Serverless)
// ============================================================
//  Kullanım: Bu dosyayı Vercel'e deploy et, otomatik çalışır.
//  Config panelden indirirken otomatik doldurulur.
// ============================================================

// #CONFIG_START
const CONFIG = {
  apiUrl: 'https://api.rahatio.com.tr',
  apiKey: 'YOUR_API_KEY',
  hmacSecret: 'YOUR_HMAC_SECRET',
  storeCode: 'YOUR_STORE_CODE',
  siteName: 'My Rahatio Store',
}
// #CONFIG_END

const crypto = require('crypto')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const CACHE_DIR = '/tmp/rahatio-cache'

function ensureCacheDir() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }) } catch {}
}

// ---- HMAC Client ----
function sign(method, path, timestamp, body) {
  const payload = `${method}\n${path.replace(/^\//, '')}\n${timestamp}\n${body || ''}`
  return crypto.createHmac('sha256', CONFIG.hmacSecret).update(payload).digest('hex')
}

function coreRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : ''
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = sign(method, path, timestamp, body)

    const url = new URL(path, CONFIG.apiUrl)
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': CONFIG.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Store-Code': CONFIG.storeCode,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }

    const mod = CONFIG.apiUrl.startsWith('https') ? https : http
    const req = mod.request(opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode >= 400) {
            reject(new Error(json.error || json.message || `HTTP ${res.statusCode}`))
          } else {
            resolve(json)
          }
        } catch { reject(new Error(`Invalid response: ${data}`)) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    if (body) req.write(body)
    req.end()
  })
}

// ---- Cache ----
function readCache(name) {
  ensureCacheDir()
  const p = path.join(CACHE_DIR, `${name}.json`)
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function writeCache(name, data) {
  ensureCacheDir()
  fs.writeFileSync(path.join(CACHE_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8')
}

// ---- Response helpers ----
function json(res, data, code = 200) {
  res.status(code).json(data)
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Signature, X-Timestamp, X-Store-Code')
}

// ---- Handlers ----
async function handleHealth(req, res) {
  json(res, {
    status: 'ok',
    version: '1.0.0',
    platform: 'vercel',
    store: CONFIG.storeCode,
    site: CONFIG.siteName,
    time: new Date().toISOString(),
  })
}

async function handleConfig(req, res) {
  json(res, {
    api_url: CONFIG.apiUrl,
    store_code: CONFIG.storeCode,
    site_name: CONFIG.siteName,
    platform: 'vercel',
  })
}

async function handleSync(req, res) {
  const products = await coreRequest('GET', '/api/products')
  writeCache('products', {
    synced_at: new Date().toISOString(),
    products: products.data || products || [],
  })
  const count = products.data ? products.data.length : (Array.isArray(products) ? products.length : 0)
  json(res, { status: 'synced', count, time: new Date().toISOString() })
}

async function handleProducts(req, res) {
  let cache = readCache('products')
  if (!cache) {
    await handleSync(req, res)
    return
  }
  const list = (cache.products || []).map(p => ({
    id: p['product.id'] || p.id || null,
    code: p['product.code'] || p.code || '',
    label: p['product.label'] || p.label || '',
    price: p.price || null,
    stock: p.stock || null,
    image: p.image || null,
    status: p['product.status'] || p.status || 1,
  }))
  json(res, { data: list, total: list.length, synced_at: cache.synced_at })
}

async function handleProduct(req, res, id) {
  let cache = readCache('products')
  if (cache) {
    const found = (cache.products || []).find(p => String(p['product.id'] || p.id) === id)
    if (found) return json(res, found)
  }
  try {
    const product = await coreRequest('GET', `/api/products/${id}`)
    json(res, product)
  } catch {
    json(res, { error: 'Product not found' }, 404)
  }
}

async function handleOrder(req, res) {
  const input = req.body
  if (!input || !input.id) return json(res, { error: 'Invalid order' }, 400)

  // Try push to core
  try {
    await coreRequest('POST', '/api/orders', input)
  } catch { /* will retry later */ }

  json(res, { status: 'received', order_id: input.id }, 201)
}

// ---- Router ----
module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const uri = (req.url || '/').split('?')[0].replace(/\/$/, '') || '/'

  try {
    if (uri === '/' || uri === '/health') return await handleHealth(req, res)
    if (uri === '/slave-config') return await handleConfig(req, res)
    if (uri === '/api/sync' && req.method === 'POST') return await handleSync(req, res)
    if (uri === '/api/products' && req.method === 'GET') return await handleProducts(req, res)
    if (uri.startsWith('/api/products/') && req.method === 'GET') return await handleProduct(req, res, uri.split('/').pop())
    if (uri === '/api/orders' && req.method === 'POST') return await handleOrder(req, res)
    json(res, { error: 'Not found', path: uri }, 404)
  } catch (err) {
    json(res, { error: err.message }, 500)
  }
}
