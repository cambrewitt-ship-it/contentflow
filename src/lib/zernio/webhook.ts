import crypto from 'crypto'
import logger from '@/lib/logger'
import { createWebhook, listWebhooks } from './api'

// Zernio webhooks into the app (comment.received for now). The app registers its own
// endpoint, so there's nothing to set up by hand: ensureZernioWebhook() runs from the
// daily Feed Checker cron. The signing secret is derived from LATE_API_KEY, so no
// extra environment variable is needed and it rotates with the key.

export const WEBHOOK_PATH = '/api/late/webhook'
export const WEBHOOK_EVENTS = ['comment.received']

export function webhookSecret(): string | null {
  const key = process.env.LATE_API_KEY
  if (!key) return null
  return crypto.createHmac('sha256', key).update('contentflow-zernio-webhook-v1').digest('hex')
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = webhookSecret()
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.trim().toLowerCase())
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function publicBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (!base || !base.startsWith('https://') || /localhost|127\.0\.0\.1/.test(base)) return null
  // Only production registers: previews would point Zernio at short-lived URLs
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return null
  return base.replace(/\/+$/, '')
}

/** Register the app's webhook with Zernio if it isn't there yet. Safe to call often. */
export async function ensureZernioWebhook(): Promise<'exists' | 'created' | 'skipped'> {
  const base = publicBaseUrl()
  const secret = webhookSecret()
  if (!base || !secret) return 'skipped'
  const url = `${base}${WEBHOOK_PATH}`
  try {
    const hooks = await listWebhooks()
    if (hooks.some((h) => h.url === url && h.isActive !== false)) return 'exists'
    await createWebhook({ name: 'Content Manager comments', url, secret, events: WEBHOOK_EVENTS })
    logger.info('Registered Zernio webhook', { url })
    statusCache = { at: Date.now(), value: 'on' }
    return 'created'
  } catch (err) {
    logger.error('Zernio webhook registration failed:', err)
    return 'skipped'
  }
}

let statusCache: { at: number; value: 'on' | 'off' | 'unknown' } | null = null

/** Whether Zernio is set to send the app new comments (cached for 10 minutes). */
export async function webhookStatus(): Promise<'on' | 'off' | 'unknown'> {
  if (statusCache && Date.now() - statusCache.at < 10 * 60_000) return statusCache.value
  let value: 'on' | 'off' | 'unknown' = 'unknown'
  try {
    const hooks = await listWebhooks()
    value = hooks.some((h) => h.url.endsWith(WEBHOOK_PATH) && h.isActive !== false && (h.events ?? WEBHOOK_EVENTS).includes('comment.received'))
      ? 'on'
      : 'off'
  } catch {
    value = 'unknown'
  }
  statusCache = { at: Date.now(), value }
  return value
}

let lastEnsured = 0

/**
 * The app switches on live comment alerts by itself: this runs (after the response)
 * whenever someone opens the dashboard or a Comments page, at most every 6 hours per
 * server instance, so no one ever has to set anything up.
 */
export async function ensureZernioWebhookOccasionally(): Promise<void> {
  if (Date.now() - lastEnsured < 6 * 3600_000) return
  lastEnsured = Date.now()
  const result = await ensureZernioWebhook()
  if (result === 'skipped') lastEnsured = Date.now() - 6 * 3600_000 + 10 * 60_000 // retry in 10 minutes
}
