import { NextResponse } from 'next/server'
import logger from '@/lib/logger'

/**
 * Cron routes are public at the middleware (GitHub Actions has no login session) and
 * guarded here instead: in production every call must carry `Authorization: Bearer
 * <CRON_SECRET>`, and with no CRON_SECRET set the route refuses to run at all.
 * Returns a response to send back when the call isn't allowed, else null.
 */
export function rejectUnauthorizedCron(req: Request, name: string): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV !== 'production') return null
  if (!secret) {
    logger.error(`Cron ${name}: CRON_SECRET is not set — refusing to run`)
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    logger.warn(`Unauthorized ${name} cron attempt`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
