'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Megaphone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authedFetchJson } from '@/lib/authedFetch'

// Ads whose comments the inbox follows. No ad account connection needed: they're found
// when an ad comment arrives (live alerts), or added here from a post link/ID.

interface AdPost {
  id: string
  platform: string
  post_id: string
  ad_title: string | null
  post_text: string | null
  post_url: string | null
  source: string
  last_comment_at: string | null
}

export function AdPostsCard({ clientId, onAdded }: { clientId: string; onAdded: () => void }) {
  const [adPosts, setAdPosts] = useState<AdPost[]>([])
  const [live, setLive] = useState<'on' | 'off' | 'unknown'>('unknown')
  const [setup, setSetup] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await authedFetchJson<{ adPosts: AdPost[]; liveAlerts: 'on' | 'off' | 'unknown'; setupRequired?: string }>(
        `/api/clients/${clientId}/comments/ad-posts`
      )
      setAdPosts(res.adPosts ?? [])
      setLive(res.liveAlerts)
      setSetup(res.setupRequired ?? null)
    } catch {
      // The inbox works without this card
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await authedFetchJson<{ synced: number }>(`/api/clients/${clientId}/comments/ad-posts`, {
        method: 'POST',
        body: { link, platform },
        timeoutMs: 60_000,
      })
      setMessage({ ok: true, text: `Added — ${res.synced} comment${res.synced === 1 ? '' : 's'} found.` })
      setLink('')
      setAdding(false)
      await load()
      onAdded()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Couldn’t add that ad' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
        <Megaphone className="h-4 w-4 text-orange-500" /> Ad comments
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        Comments on this client&apos;s ads (dark posts and boosted posts) — no ad account connection needed. An ad is picked up the
        moment someone comments on it, with all its earlier comments.
      </p>

      {setup ? (
        <p className="text-xs text-amber-700">{setup}</p>
      ) : (
        <>
          {live === 'off' && (
            <p className="mb-3 flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Live comment alerts aren&apos;t switched on yet, so new ads won&apos;t be found automatically. They switch on when the
              Feed Checker scheduled job runs in production — or add an ad below.
            </p>
          )}
          {live === 'on' && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Live comment alerts are on
            </p>
          )}

          {adPosts.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {adPosts.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded-lg border border-gray-100 px-2.5 py-1.5 text-xs">
                  <p className="line-clamp-1 text-gray-800">{a.ad_title || a.post_text || a.post_id}</p>
                  <p className="text-gray-400">
                    <span className="capitalize">{a.platform}</span>
                    {a.last_comment_at && ` · last comment ${new Date(a.last_comment_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                    {a.post_url && (
                      <>
                        {' · '}
                        <a href={a.post_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          view
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="space-y-2">
              <div className="inline-flex rounded-md bg-gray-100 p-0.5 text-xs">
                {(['facebook', 'instagram'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`rounded px-2 py-0.5 capitalize ${platform === p ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={platform === 'facebook' ? 'Post ID (1234_5678) or link' : 'Instagram media ID'}
              />
              <p className="text-[11px] text-gray-500">
                {platform === 'facebook'
                  ? 'In Ads Manager, open the ad → “Preview” → “Facebook post with comments” and copy the link, or the post ID from Business Suite.'
                  : 'Instagram ad comments are picked up automatically when someone comments.'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={add} disabled={busy || !link.trim()}>
                  {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Add ad
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add an ad
            </Button>
          )}
          {message && <p className={`mt-2 text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
        </>
      )}
    </section>
  )
}
