'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquareText, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authedFetchJson } from '@/lib/authedFetch'

// Keyword auto-DMs (Zernio comment-to-DM automations): comment "MENU" on any post and
// get the menu link by DM. Instagram and Facebook.

interface Automation {
  id: string
  name: string
  accountId: string
  keywords?: string[]
  dmMessage?: string
  commentReply?: string
  isActive?: boolean
  stats?: Record<string, number>
}

interface Account {
  id: string
  platform: string
  username: string
}

export function AutoDmCard({ clientId }: { clientId: string }) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ accountId: '', keywords: '', dmMessage: '', commentReply: '' })

  const load = useCallback(async () => {
    try {
      const res = await authedFetchJson<{ automations: Automation[]; accounts: Account[] }>(`/api/clients/${clientId}/comment-automations`)
      setAutomations(res.automations ?? [])
      setAccounts(res.accounts ?? [])
      setForm((f) => ({ ...f, accountId: f.accountId || res.accounts?.[0]?.id || '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load auto-DMs')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      await authedFetchJson(`/api/clients/${clientId}/comment-automations`, {
        method: 'POST',
        body: {
          accountId: form.accountId,
          keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
          dmMessage: form.dmMessage,
          commentReply: form.commentReply,
        },
      })
      setForm({ accountId: form.accountId, keywords: '', dmMessage: '', commentReply: '' })
      setAdding(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the auto-DM')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (a: Automation) => {
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)))
    try {
      await authedFetchJson(`/api/clients/${clientId}/comment-automations/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update')
      await load()
    }
  }

  const remove = async (a: Automation) => {
    if (!window.confirm(`Delete the auto-DM "${a.name}"?`)) return
    try {
      await authedFetchJson(`/api/clients/${clientId}/comment-automations/${a.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.platform === 'instagram' ? 'Instagram' : 'Facebook'} · ${a.username}` : 'Account'
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
        <MessageSquareText className="h-4 w-4 text-fuchsia-500" /> Keyword auto-DMs
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        When someone comments a keyword (e.g. &ldquo;MENU&rdquo;) on any post, they get a DM straight away. Instagram and Facebook.
      </p>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : (
        <>
          {automations.length > 0 && (
            <ul className="mb-3 space-y-2">
              {automations.map((a) => (
                <li key={a.id} className="rounded-lg border border-gray-100 p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{(a.keywords ?? []).join(', ') || a.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(a)}
                        aria-label={a.isActive === false ? 'Turn on' : 'Pause'}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${a.isActive === false ? 'bg-gray-300' : 'bg-blue-600'}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${a.isActive === false ? 'left-0.5' : 'left-[18px]'}`} />
                      </button>
                      <button type="button" onClick={() => remove(a)} className="p-1 text-gray-400 hover:text-red-600" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{accountLabel(a.accountId)}</p>
                  {a.dmMessage && <p className="mt-1 line-clamp-2 text-xs text-gray-700">DM: {a.dmMessage}</p>}
                </li>
              ))}
            </ul>
          )}

          {accounts.length === 0 ? (
            <p className="text-xs text-gray-500">Connect an Instagram or Facebook account to use auto-DMs.</p>
          ) : adding ? (
            <div className="space-y-2">
              <select
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                aria-label="Account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a.id)}
                  </option>
                ))}
              </select>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Keywords, comma separated (e.g. MENU, LINK)" />
              <textarea
                value={form.dmMessage}
                onChange={(e) => setForm({ ...form, dmMessage: e.target.value })}
                rows={3}
                placeholder="The DM they get, e.g. Here's our menu 👉 https://…"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
              <Input
                value={form.commentReply}
                onChange={(e) => setForm({ ...form, commentReply: e.target.value })}
                placeholder="Optional public reply, e.g. Sent you a DM! 💌"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={create} disabled={saving}>
                  {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Create auto-DM
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> New auto-DM
            </Button>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
