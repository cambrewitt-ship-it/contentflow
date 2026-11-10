'use client'

import { useState } from 'react'
import {
  Check,
  EyeOff,
  Eye,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import type { CommentAction, CommentRow } from '@/lib/comments/types'

// One comment on a client's post, with the AI's read on it and its drafted reply, and
// every action Zernio allows on that platform. Used by the Comments inbox and the
// calendar post modal.

const CATEGORY_STYLE: Record<string, string> = {
  praise: 'bg-emerald-50 text-emerald-700',
  question: 'bg-blue-50 text-blue-700',
  complaint: 'bg-amber-50 text-amber-800',
  spam: 'bg-gray-100 text-gray-600',
  abuse: 'bg-red-50 text-red-700',
  other: 'bg-gray-50 text-gray-600',
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function CommentCard({
  clientId,
  comment,
  onChange,
  compact,
}: {
  clientId: string
  comment: CommentRow
  onChange: (c: CommentRow) => void
  compact?: boolean
}) {
  const c = comment
  const [mode, setMode] = useState<'public' | 'private'>('public')
  const [text, setText] = useState(c.suggestedReply ?? '')
  const [privateText, setPrivateText] = useState(c.suggestedPrivateReply ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const metaPlatform = c.platform === 'instagram' || c.platform === 'facebook'
  const handled = c.status !== 'new'

  const act = async (action: CommentAction, message?: string) => {
    if (action === 'delete' && !window.confirm('Delete this comment from the post? This can’t be undone.')) return
    setBusy(action)
    setError(null)
    try {
      const res = await authedFetchJson<{ comment: CommentRow }>(`/api/clients/${clientId}/comments/${c.id}`, {
        method: 'POST',
        body: { action, message },
      })
      onChange(res.comment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work')
    } finally {
      setBusy(null)
    }
  }

  const redraft = async () => {
    setBusy('redraft')
    setError(null)
    try {
      const res = await authedFetchJson<{ reply: string }>(`/api/clients/${clientId}/comments/${c.id}/redraft`, {
        method: 'POST',
        body: { private: mode === 'private' },
      })
      if (mode === 'private') setPrivateText(res.reply)
      else setText(res.reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write a reply')
    } finally {
      setBusy(null)
    }
  }

  const icon = (name: string, Icon: typeof Check) =>
    busy === name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />
  const btn = 'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50'

  return (
    <div className={`rounded-xl border bg-white p-3 ${c.isHidden ? 'border-dashed border-gray-300 opacity-75' : 'border-gray-200'}`}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-orange-300 text-xs font-semibold text-white">
          {c.authorPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.authorPicture} alt="" className="h-full w-full object-cover" />
          ) : (
            (c.authorName || c.authorUsername || '?').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-semibold text-gray-900">{c.authorName || c.authorUsername || 'Someone'}</span>
            {c.authorUsername && c.authorName && <span className="text-gray-400">@{c.authorUsername}</span>}
            <span className="capitalize text-gray-400">· {c.platform} · {timeAgo(c.commentedAt)}</span>
            {c.parentCommentId && <span className="text-gray-400">· reply</span>}
            {c.category && c.category !== 'own' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${CATEGORY_STYLE[c.category] ?? ''}`}>{c.category}</span>
            )}
            {c.isHidden && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">hidden</span>}
            {c.autoAction && (
              <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                Feed Checker {c.autoAction === 'hearted' ? 'replied ❤️' : c.autoAction}
              </span>
            )}
            {c.commentUrl && (
              <a href={c.commentUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600" title="Open on the platform">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">{c.message || <em className="text-gray-400">(sticker or photo)</em>}</p>
          {c.triageNote && !compact && <p className="mt-0.5 text-[11px] text-gray-400">AI: {c.triageNote}</p>}
          {c.replyText && <p className="mt-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">You replied: {c.replyText}</p>}

          {!c.isOwn && c.status === 'new' && c.canReply && (
            <div className="mt-2 space-y-1.5">
              {metaPlatform && (
                <div className="inline-flex rounded-md bg-gray-100 p-0.5 text-[11px]">
                  {(['public', 'private'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded px-2 py-0.5 ${mode === m ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                      {m === 'public' ? 'Reply' : 'Private DM'}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={mode === 'public' ? text : privateText}
                onChange={(e) => (mode === 'public' ? setText(e.target.value) : setPrivateText(e.target.value))}
                rows={2}
                placeholder={mode === 'public' ? 'Write a reply…' : 'Write a private message… (one per comment, within 7 days)'}
                className="w-full resize-y rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={!!busy || !(mode === 'public' ? text : privateText).trim()}
                  onClick={() => act(mode === 'public' ? 'reply' : 'private_reply', mode === 'public' ? text : privateText)}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy === 'reply' || busy === 'private_reply' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {mode === 'public' ? 'Send reply' : 'Send DM'}
                </button>
                <button type="button" className={btn} disabled={!!busy} onClick={redraft} title="Write a different reply (1 AI credit)">
                  {icon('redraft', Sparkles)} Redraft
                </button>
                <button type="button" className={btn} disabled={!!busy} onClick={() => act('done')} title="No reply needed">
                  {icon('done', Check)} Done
                </button>
              </div>
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
            {!c.isOwn && (c.canLike || c.platform === 'instagram') && (
              <button type="button" className={btn} disabled={!!busy} onClick={() => act(c.isLiked ? 'unlike' : 'like')}>
                {icon(c.isLiked ? 'unlike' : 'like', c.isLiked ? Heart : ThumbsUp)} {c.isLiked ? 'Liked' : 'Like'}
              </button>
            )}
            {!c.isOwn && c.canHide && (
              <button type="button" className={btn} disabled={!!busy} onClick={() => act(c.isHidden ? 'unhide' : 'hide')}>
                {icon(c.isHidden ? 'unhide' : 'hide', c.isHidden ? Eye : EyeOff)} {c.isHidden ? 'Unhide' : 'Hide'}
              </button>
            )}
            {c.canDelete && c.status !== 'deleted' && (
              <button type="button" className={`${btn} hover:text-red-600`} disabled={!!busy} onClick={() => act('delete')}>
                {icon('delete', Trash2)} Delete
              </button>
            )}
            {handled && !c.isOwn && c.status !== 'deleted' && (
              <button type="button" className={btn} disabled={!!busy} onClick={() => act('reopen')}>
                {icon('reopen', RotateCcw)} Reopen
              </button>
            )}
            {c.status === 'deleted' && <span className="text-xs text-gray-400">Deleted</span>}
            {!compact && c.postUrl && (
              <a href={c.postUrl} target="_blank" rel="noreferrer" className={btn}>
                <MessageCircle className="h-3.5 w-3.5" /> Post
              </a>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}
