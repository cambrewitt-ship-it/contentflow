'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessagesSquare } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import type { CommentRow } from '@/lib/comments/types'
import { CommentCard } from './CommentCard'

// Comments on one published post, in the calendar post modal, with AI reply drafts.

export function PostComments({ clientId, latePostId }: { clientId: string; latePostId: string }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setComments(null)
    authedFetchJson<{ comments: CommentRow[] }>(`/api/clients/${clientId}/comments/for-post?latePostId=${encodeURIComponent(latePostId)}`, {
      timeoutMs: 60_000,
    })
      .then((res) => !cancelled && setComments(res.comments ?? []))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load comments'))
    return () => {
      cancelled = true
    }
  }, [clientId, latePostId])

  const visible = comments ?? []
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <MessagesSquare className="h-3.5 w-3.5" /> Comments {comments && comments.length > 0 && `(${comments.length})`}
      </p>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : comments === null ? (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-500">No comments yet.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {visible.map((c) => (
            <CommentCard
              key={c.id}
              clientId={clientId}
              comment={c}
              compact
              onChange={(u) => setComments((list) => (list ?? []).map((x) => (x.id === u.id ? u : x)))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
