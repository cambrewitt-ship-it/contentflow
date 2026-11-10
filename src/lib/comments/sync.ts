import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { autoModerate, getFeedAgentSettings, syncClientComments, triageComments } from './store'

// When a client's comments were last pulled from Zernio (clients.feed_agent_last_run),
// so the inbox refreshes in the background at most every few minutes.

const SYNC_GAP_MS = 10 * 60 * 1000

export async function commentsSyncedAt(admin: SupabaseClient, clientId: string): Promise<string | null> {
  const { data } = await admin.from('clients').select('feed_agent_last_run').eq('id', clientId).maybeSingle()
  const run = (data?.feed_agent_last_run ?? {}) as Record<string, unknown>
  return typeof run.commentsSyncedAt === 'string' ? run.commentsSyncedAt : null
}

async function markSynced(admin: SupabaseClient, clientId: string) {
  const { data } = await admin.from('clients').select('feed_agent_last_run').eq('id', clientId).maybeSingle()
  const run = (data?.feed_agent_last_run ?? {}) as Record<string, unknown>
  await admin
    .from('clients')
    .update({ feed_agent_last_run: { ...run, commentsSyncedAt: new Date().toISOString() } })
    .eq('id', clientId)
}

/** Pull, triage and (if the Feed Checker is on) moderate a client's recent comments. */
export async function refreshComments(
  admin: SupabaseClient,
  clientId: string,
  opts: { force?: boolean } = {}
): Promise<{ synced: number; triaged: number; hidden: number; liked: number; hearted: number } | null> {
  if (!opts.force) {
    const at = await commentsSyncedAt(admin, clientId)
    if (at && Date.now() - Date.parse(at) < SYNC_GAP_MS) return null
  }
  await markSynced(admin, clientId)
  try {
    const { synced } = await syncClientComments(admin, clientId)
    let triaged = 0
    // Triage in batches until nothing new is left (bounded)
    for (let i = 0; i < 3; i++) {
      const n = await triageComments(admin, clientId)
      triaged += n
      if (n < 40) break
    }
    const moderation = await autoModerate(admin, clientId, await getFeedAgentSettings(admin, clientId))
    return { synced, triaged, ...moderation }
  } catch (err) {
    logger.error('Refresh comments failed', { clientId, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}
