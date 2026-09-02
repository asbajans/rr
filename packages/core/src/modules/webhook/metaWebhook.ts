import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { Setting } from '../../models/Setting.model.js';

export const metaWebhookRoutes: Router = Router();

async function getVerifyToken(): Promise<string> {
  const fromEnv = (config.meta as any).webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || ''
  if (fromEnv) return String(fromEnv)
  try {
    const row = await Setting.findOne({ where: { key: 'meta_webhook_verify_token' } as any })
    if (row) return String((row as any).value || '')
  } catch {}
  return ''
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader) return false
  // X-Hub-Signature-256: sha256=<hex>
  const parts = signatureHeader.split('=')
  if (parts.length !== 2 || parts[0] !== 'sha256') return false
  const expectedHex = parts[1]
  const hmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  // timingSafeEqual requires same length
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(hmac, 'hex'))
  } catch {
    return false
  }
}

// GET -> Meta verification (hub.mode=subscribe & hub.verify_token & hub.challenge)
metaWebhookRoutes.get('/meta', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined
  const token = req.query['hub.verify_token'] as string | undefined
  const challenge = req.query['hub.challenge'] as string | undefined

  logger.info({ mode, token: token ? '***' : undefined, challenge: challenge ? 'present' : 'missing' }, 'Meta webhook verify GET')

  if (mode !== 'subscribe') {
    return res.status(403).send('Invalid hub.mode')
  }
  const expected = await getVerifyToken()
  if (!expected) {
    logger.error('Meta webhook verify failed: no verify token configured (META_WEBHOOK_VERIFY_TOKEN)')
    return res.status(500).send('Verify token not configured')
  }
  if (token !== expected) {
    logger.warn({ expected: '***', got: token ? '***' : 'missing' }, 'Meta webhook verify token mismatch')
    return res.status(403).send('Verify token mismatch')
  }
  if (!challenge) return res.status(400).send('Missing hub.challenge')
  // Must return challenge as plain text
  res.set('Content-Type', 'text/plain')
  return res.status(200).send(challenge)
})

// POST -> Meta events (Catalog, Page, Instagram)
metaWebhookRoutes.post('/meta', async (req: Request, res: Response) => {
  // raw body is Buffer if express.raw was used, else object
  const rawBody: Buffer = Buffer.isBuffer((req as any).body) ? (req as any).body as Buffer : Buffer.from(JSON.stringify((req as any).body || {}))
  const signature = req.headers['x-hub-signature-256'] as string | undefined

  // Optional signature verification (requires appSecret)
  const appSecret = config.meta.appSecret || process.env.META_APP_SECRET || ''
  if (appSecret && signature) {
    const ok = verifySignature(rawBody, signature, appSecret)
    if (!ok) {
      logger.warn('Meta webhook signature invalid')
      // still return 200 to avoid Meta retry storm, but log
      // return res.status(401).send('Invalid signature')
    }
  } else if (appSecret && !signature) {
    logger.warn('Meta webhook missing X-Hub-Signature-256 header')
  }

  let body: any
  try {
    body = Buffer.isBuffer((req as any).body) ? JSON.parse(rawBody.toString('utf8') || '{}') : (req as any).body
  } catch {
    body = {}
  }

  logger.info({ body: JSON.stringify(body).slice(0, 2000) }, 'Meta webhook POST received')

  // Basic handling: log and ack. Extend to update catalog / page / IG as needed.
  try {
    const entries = Array.isArray(body.entry) ? body.entry : []
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : []
      for (const ch of changes) {
        const field = ch.field
        const value = ch.value
        logger.info({ field, value: JSON.stringify(value).slice(0, 1000) }, 'Meta webhook change')
        // TODO: handle Catalog: product_item_update, Page: feed, Instagram: comments/messages
        // Example: if field === 'product_catalog' -> sync catalog items
      }
      // Instagram messaging standby etc.
      const messaging = entry.messaging
      if (Array.isArray(messaging)) {
        logger.info({ messaging: JSON.stringify(messaging).slice(0, 1000) }, 'Meta webhook messaging')
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'Meta webhook processing error')
  }

  // Must return 200 quickly (Meta retries on non-2xx for 20s)
  return res.status(200).send('EVENT_RECEIVED')
})
