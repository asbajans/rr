// ============================================================
//  Rahatio Slave Node — Vercel (Serverless) + Storefront
// ============================================================
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
async function ensureProductsCache() {
  let cache = readCache('products')
  const age = cache ? (Date.now() - new Date(cache.synced_at).getTime()) : Infinity
  if (cache && cache.products && age < 5 * 60 * 1000) return cache
  try {
    const resp = await coreRequest('GET', '/api/slave/products')
    const products = resp.data || resp || []
    const data = { synced_at: new Date().toISOString(), products: Array.isArray(products) ? products : [] }
    writeCache('products', data)
    return data
  } catch (e) {
    return cache || { synced_at: null, products: [] }
  }
}

// ---- Helpers ----
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function formatPrice(p) { if (p==null || p==='' || Number(p)===0) return '—'; return Number(p).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ₺' }

function getBase(req){ const h=req.headers.host||''; const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0]; return proto+'://'+h }
function storefrontHtml(products, syncedAt, req) {
  const base = req ? getBase(req) : ''
  const active = products.filter(p => (p['product.status'] ?? p.status ?? 1) == 1)
  const total = active.length
  const cards = total===0
    ? `<div class="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center"><p class="text-sm font-medium">Henüz ürün yok</p><p class="mx-auto mt-2 max-w-md text-xs text-zinc-500">Panelden ürün ekleyin. Cache 5 dk’da yenilenir.</p></div>`
    : `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">` + active.map(p => {
        const id = p['product.id'] ?? p.id ?? ''
        const label = p['product.label'] ?? p.label ?? p.title ?? 'Ürün'
        const code = p['product.code'] ?? p.code ?? p.sku ?? ''
        const price = p.price ?? p.priceTRY ?? null
        const stock = p.stock ?? p.quantity ?? null
        const img = p.image ?? (Array.isArray(p.images) ? p.images[0] : null)
        const desc = (p.description ?? '').toString().slice(0,120)
        return `<a href="/product/${esc(id)}" class="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"><div class="aspect-[4/3] overflow-hidden bg-zinc-100">${img ? `<img src="${esc(img)}" alt="${esc(label)}" class="h-full w-full object-cover group-hover:scale-[1.02] transition" loading="lazy">` : `<div class="flex h-full w-full items-center justify-center text-xs text-zinc-400">Görsel yok</div>`}</div><div class="flex flex-1 flex-col p-4"><div class="line-clamp-2 text-sm font-semibold">${esc(label)}</div>${code ? `<div class="mt-1 text-xs text-zinc-500">${esc(code)}</div>` : ''}${desc ? `<div class="mt-2 line-clamp-2 text-xs text-zinc-500">${esc(desc)}</div>` : ''}<div class="mt-3 flex items-center justify-between"><div class="text-sm font-bold">${esc(formatPrice(price))}</div><span class="rounded-full px-2 py-0.5 text-xs font-medium ${stock!=null && Number(stock)<=0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}">${stock!=null ? esc(stock)+' stok' : 'Stok bilgisi'}</span></div><div class="mt-3 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">Detay →</div></div></a>`
      }).join('') + `</div>`
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(CONFIG.siteName)} — Mağaza</title><meta name="description" content="${esc(CONFIG.siteName + ' — kaliteli ürünler')}"><link rel="canonical" href="${esc(base+'/')}"><meta name="robots" content="index, follow"><link rel="sitemap" type="application/xml" href="/sitemap.xml"><meta property="og:title" content="${esc(CONFIG.siteName)}"><meta property="og:url" content="${esc(base+'/')}"><meta property="og:type" content="website"><script src="https://cdn.tailwindcss.com"></script><script type="application/ld+json">${JSON.stringify({ '@context':'https://schema.org','@type':'Store',name:CONFIG.siteName, url: base+'/' })}</script></head><body class="bg-zinc-50 text-zinc-900">
<header class="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur"><div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div class="flex items-center gap-3"><div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">${esc(CONFIG.siteName.slice(0,1))}</div><div><div class="text-sm font-semibold">${esc(CONFIG.siteName)}</div><div class="text-xs text-zinc-500">${esc(CONFIG.storeCode)} · vercel slave</div></div></div><div class="flex items-center gap-2"><a href="/sitemap.xml" class="hidden text-xs text-zinc-400 hover:underline sm:inline">sitemap</a><a href="/cart" class="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">Sepet (<span id="cart-count">0</span>)</a></div></div></header>
<section class="mx-auto max-w-6xl px-4 pt-8"><div class="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8"><h1 class="text-2xl font-bold tracking-tight">${esc(CONFIG.siteName)}</h1><p class="mt-2 max-w-2xl text-sm text-zinc-600">Ürünler Rahatio API üzerinden senkronize edilir. Sitemap ve SEO hazır.</p><div class="mt-4 flex flex-wrap items-center gap-3 text-xs"><span class="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">${total} ürün</span>${syncedAt ? `<span class="text-zinc-500">Son senk: ${esc(new Date(syncedAt).toLocaleString('tr-TR'))}</span>` : '<span class="text-amber-600">Henüz senk edilmedi</span>'} · <a href="/sitemap.xml" class="text-indigo-600 hover:underline">sitemap.xml</a> · <a href="/robots.txt" class="text-indigo-600 hover:underline">robots.txt</a></div></div></section>
<section class="mx-auto max-w-6xl px-4 py-8">${cards}</section>
<footer class="mx-auto max-w-6xl px-4 pb-8"><div class="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500"><div class="flex flex-wrap gap-3"><a href="/" class="hover:underline">Ana Sayfa</a> · <a href="/sitemap.xml" class="hover:underline">Sitemap</a> · <a href="/robots.txt" class="hover:underline">Robots</a> · <a href="/health" class="underline">health</a></div><div class="mt-2">Powered by <b>Rahatio Slave</b> · ${esc(CONFIG.storeCode)} · Vercel</div></div></footer><script>try{var c=JSON.parse(localStorage.getItem("rahatio_cart")||"[]");document.getElementById("cart-count").textContent=c.reduce((s,i)=>s+(i.qty||1),0)}catch(e){}</script>
</body></html>`
}
function productHtml(p, req) {
  const label = p['product.label'] ?? p.label ?? p.title ?? 'Ürün'
  const code = p['product.code'] ?? p.code ?? p.sku ?? ''
  const price = p.price ?? p.priceTRY ?? null
  const stock = p.stock ?? p.quantity ?? null
  const img = p.image ?? (Array.isArray(p.images) ? p.images[0] : null)
  const images = p.images ?? (img ? [img] : [])
  const desc = p.description ?? ''
  const base = req ? getBase(req) : ''
  const id = p['product.id'] ?? p.id ?? ''
  const canonical = base + '/product/' + encodeURIComponent(id)
  const metaDesc = (desc||'').toString().slice(0,160) || label
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} — ${esc(CONFIG.siteName)}</title><meta name="description" content="${esc(metaDesc)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(label)}"><meta property="og:description" content="${esc(metaDesc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="product">${img?`<meta property="og:image" content="${esc(img)}">`:''}<meta name="robots" content="index, follow"><script src="https://cdn.tailwindcss.com"></script><script type="application/ld+json">${JSON.stringify({ '@context':'https://schema.org','@type':'Product',name:label, description:metaDesc, sku:code, image:img||undefined, offers:{ '@type':'Offer', price:price, priceCurrency:'TRY', availability: stock!=null && Number(stock)>0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'}})}</script></head><body class="bg-zinc-50 text-zinc-900">
<header class="border-b border-zinc-200 bg-white"><div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><a href="/" class="text-sm font-semibold">← ${esc(CONFIG.siteName)}</a><div class="flex items-center gap-2"><a href="/cart" class="text-xs text-zinc-500">Sepet</a><a href="/" class="text-xs text-zinc-500">Ana sayfa</a></div></div></header>
<main class="mx-auto max-w-6xl px-4 py-8"><div class="grid gap-8 lg:grid-cols-2">
<div class="space-y-3">${img ? `<div class="overflow-hidden rounded-xl border border-zinc-200 bg-white"><img src="${esc(img)}" alt="${esc(label)}" class="aspect-[4/3] w-full object-cover"></div>` : `<div class="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-400">Görsel yok</div>`}${images.length>1 ? `<div class="grid grid-cols-4 gap-2">${images.slice(0,8).map(im=>`<img src="${esc(im)}" class="aspect-square rounded-lg border border-zinc-200 object-cover">`).join('')}</div>` : ''}</div>
<div class="rounded-xl border border-zinc-200 bg-white p-6"><h1 class="text-xl font-bold">${esc(label)}</h1>${code ? `<div class="mt-1 text-xs text-zinc-500">Kod: ${esc(code)} · ID: ${esc(p['product.id'] ?? p.id ?? '')}</div>` : ''}<div class="mt-4 flex items-baseline gap-3"><div class="text-2xl font-bold">${esc(formatPrice(price))}</div><span class="rounded-full px-2.5 py-1 text-xs font-medium ${stock!=null && Number(stock)<=0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}">${stock!=null ? esc(stock)+' adet stok' : 'Stok bilgisi yok'}</span></div>${desc ? `<div class="prose prose-sm mt-6 max-w-none text-sm leading-relaxed text-zinc-700">${esc(desc).replace(/\n/g,'<br>')}</div>` : '<p class="mt-6 text-sm text-zinc-500">Açıklama yok.</p>'}<div class="mt-6 flex flex-wrap gap-2"><button data-id="${esc(String(id))}" data-label="${esc(label)}" data-price="${esc(String(price??''))}" onclick="addToCart(this.dataset.id,this.dataset.label,this.dataset.price)" class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">Sepete Ekle</button><a href="/" class="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50">← Mağazaya dön</a></div><p id="cart-msg" class="mt-3 hidden text-sm text-emerald-600">✓ Sepete eklendi — <a href="/cart" class="underline">Sepete git</a></p></div>
</div></main>
<footer class="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-zinc-400">Powered by Rahatio Slave · ${esc(CONFIG.storeCode)} · <a href="/sitemap.xml" class="underline">Sitemap</a></footer><script>function addToCart(id,label,price){try{var c=JSON.parse(localStorage.getItem("rahatio_cart")||"[]");var f=c.find(x=>String(x.id)===String(id));if(f)f.qty=(f.qty||1)+1;else c.push({id:id,label:label,price:price,qty:1});localStorage.setItem("rahatio_cart",JSON.stringify(c));var el=document.getElementById("cart-msg");if(el)el.classList.remove("hidden")}catch(e){alert(e.message)}}</script>
</body></html>`
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
function html(res, body, code=200) {
  res.status(code).setHeader('Content-Type','text/html; charset=utf-8').send(body)
}

// ---- Handlers ----
async function handleHealth(req, res) {
  json(res, { status: 'ok', version: '1.2.0', platform: 'vercel', store: CONFIG.storeCode, site: CONFIG.siteName, time: new Date().toISOString() })
}
async function handleConfig(req, res) {
  json(res, { api_url: CONFIG.apiUrl, store_code: CONFIG.storeCode, site_name: CONFIG.siteName, platform: 'vercel' })
}
async function handleSync(req, res) {
  const resp = await coreRequest('GET', '/api/slave/products')
  const products = resp.data || resp || []
  writeCache('products', { synced_at: new Date().toISOString(), products: Array.isArray(products) ? products : [] })
  const count = Array.isArray(products) ? products.length : (resp.data ? resp.data.length : 0)
  json(res, { status: 'synced', count, time: new Date().toISOString() })
}
async function handleProducts(req, res) {
  const cache = await ensureProductsCache()
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
  const cache = await ensureProductsCache()
  if (cache) {
    const found = (cache.products || []).find(p => String(p['product.id'] || p.id) === id)
    if (found) return json(res, found)
  }
  try {
    const product = await coreRequest('GET', `/api/slave/products/${id}`)
    json(res, product)
  } catch {
    json(res, { error: 'Product not found' }, 404)
  }
}
async function handleStorefront(req, res) {
  const cache = await ensureProductsCache()
  html(res, storefrontHtml(cache.products || [], cache.synced_at, req))
}
async function handleProductPage(req, res, id) {
  const cache = await ensureProductsCache()
  let p = (cache.products || []).find(x => String(x['product.id'] || x.id) === String(id))
  if (!p) {
    try { p = await coreRequest('GET', `/api/slave/products/${id}`); if (p.data) p = p.data } catch { p=null }
  }
  if (!p) return html(res, `<!doctype html><html><head><meta charset="utf-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><div class="mx-auto max-w-xl px-4 py-16 text-center"><h1 class="text-3xl font-bold">404</h1><p class="mt-2 text-sm text-zinc-600">Ürün bulunamadı: ${esc(id)}</p><a href="/" class="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">Ana sayfa</a></div></body></html>`, 404)
  html(res, productHtml(p, req))
}
async function handleSitemap(req,res){
  const cache=await ensureProductsCache(); const base=getBase(req); const products=cache.products||[];
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  let xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml+=`  <url><loc>${esc(base+'/')}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
  for(const p of products){ if((p['product.status']??p.status??1)!=1) continue; const id=p['product.id']??p.id; if(!id) continue; xml+=`  <url><loc>${esc(base+'/product/'+encodeURIComponent(id))}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`; }
  xml+='</urlset>'; res.send(xml)
}
async function handleRobots(req,res){
  const base=getBase(req);
  res.setHeader('Content-Type','text/plain; charset=utf-8'); res.send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`)
}
async function handleOrder(req, res) {
  const input = req.body
  if (!input || !input.id) return json(res, { error: 'Invalid order' }, 400)
  try { await coreRequest('POST', '/api/slave/orders', input) } catch {}
  json(res, { status: 'received', order_id: input.id }, 201)
}

// ---- Router ----
module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const uri = (url.pathname || '/').replace(/\/$/, '') || '/'
  const accept = req.headers.accept || ''
  const wantsHtml = accept.includes('text/html')

  try {
    if (uri === '/health') return await handleHealth(req, res)
    if (uri === '/slave-config') return await handleConfig(req, res)
    if (uri === '/api/slave/sync' && req.method === 'POST') return await handleSync(req, res)
    if (uri === '/api/slave/products' && req.method === 'GET') return await handleProducts(req, res)
    if (uri.startsWith('/api/slave/products/') && req.method === 'GET') return await handleProduct(req, res, uri.split('/').pop())
    if (uri === '/api/slave/orders' && req.method === 'POST') return await handleOrder(req, res)
    // Legacy API (without /slave prefix) — keep compat
    if (uri === '/api/sync' && req.method === 'POST') return await handleSync(req, res)
    if (uri === '/api/products' && req.method === 'GET') return await handleProducts(req, res)
    if (uri.startsWith('/api/products/') && req.method === 'GET') return await handleProduct(req, res, uri.split('/').pop())
    if (uri === '/api/orders' && req.method === 'POST') return await handleOrder(req, res)
    if (uri === '/sitemap.xml' && req.method==='GET') return await handleSitemap(req,res)
    if (uri === '/robots.txt' && req.method==='GET') return await handleRobots(req,res)
    // Storefront
    if (uri === '/' && req.method === 'GET') {
      if (url.searchParams.get('format') === 'json') return await handleProducts(req,res)
      return await handleStorefront(req,res)
    }
    if (uri.startsWith('/product/') && req.method === 'GET') return await handleProductPage(req,res, uri.split('/')[2])
    if (uri === '/products' && req.method === 'GET') return await handleStorefront(req,res)
    // 404
    if (wantsHtml) {
      html(res, `<!doctype html><html><head><meta charset="utf-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><div class="mx-auto max-w-xl px-4 py-16 text-center"><h1 class="text-3xl font-bold">404</h1><p class="mt-2 text-sm text-zinc-600">Sayfa bulunamadı: ${esc(uri)}</p><a href="/" class="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">Ana sayfa</a><p class="mt-6 text-xs text-zinc-400"><a href="/health" class="underline">/health</a> · <a href="/slave-config" class="underline">/slave-config</a></p></div></body></html>`, 404)
    } else {
      json(res, { error: 'Not found', path: uri }, 404)
    }
  } catch (err) {
    if (wantsHtml) html(res, `<!doctype html><html><head><meta charset="utf-8"><title>Hata</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><div class="mx-auto max-w-xl px-4 py-16"><h1 class="text-xl font-bold text-red-700">Hata</h1><pre class="mt-3 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">${esc(err.message)}</pre><a href="/" class="mt-4 inline-block text-sm text-indigo-600 hover:underline">Ana sayfa</a></div></body></html>`,500)
    else json(res, { error: err.message }, 500)
  }
}
