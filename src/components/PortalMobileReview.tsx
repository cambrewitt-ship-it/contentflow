'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, MessageSquare, PartyPopper, X } from 'lucide-react';
import { CarouselMedia } from '@/components/CarouselMedia';
import { PlatformBadges } from '@/components/PlatformBadges';
import { isVideoUrl } from '@/lib/videoUtils';
import logger from '@/lib/logger';

export interface ReviewPost {
  id: string;
  caption: string;
  image_url?: string | null;
  media_urls?: string[] | null;
  scheduled_date?: string;
  scheduled_time?: string | null;
  platforms_scheduled?: string[];
}

interface PortalMobileReviewProps {
  token: string;
  posts: ReviewPost[];
  onClose: () => void;
  /** Called once when the sheet closes after at least one decision, so the portal can refetch. */
  onReviewed: () => void;
}

function formatWhen(date?: string, time?: string | null) {
  if (!date) return 'Unscheduled';
  const d = new Date(`${date}T${time || '00:00:00'}`);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return time ? `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : day;
}

/**
 * Full-screen, one-post-at-a-time review for clients on their phone:
 * Approve, or request changes with a note. Uses the same portal approvals
 * endpoint as the post modal's direct approval / "Improve" actions.
 */
export function PortalMobileReview({ token, posts, onClose, onReviewed }: PortalMobileReviewProps) {
  // Freeze the queue when the sheet opens so decisions don't reshuffle it underneath the client
  const [queue] = useState(posts);
  const [index, setIndex] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState(0);

  const post = queue[index];
  const media = useMemo(() => {
    if (!post) return [];
    const urls = post.media_urls?.length ? post.media_urls : post.image_url ? [post.image_url] : [];
    return urls.map((url) => ({ url, isVideo: isVideoUrl(url) }));
  }, [post]);

  const close = () => {
    if (decided > 0) onReviewed();
    onClose();
  };

  const next = () => {
    setIndex((i) => i + 1);
    setMediaIndex(0);
    setRequesting(false);
    setNote('');
    setError(null);
  };

  const submit = async (status: 'approved' | 'needs_attention') => {
    if (!post) return;
    if (status === 'needs_attention' && !note.trim()) {
      setError('Tell us what to change first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          post_id: post.id,
          post_type: 'planner_scheduled',
          approval_status: status,
          client_comments: status === 'needs_attention' ? note.trim() : '',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save. Please try again.');
        return;
      }
      setDecided((n) => n + 1);
      next();
    } catch (err) {
      logger.error('Mobile review submit error:', err);
      setError('Could not save. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label="Review posts">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900">Review posts</p>
          {post && (
            <p className="text-xs text-gray-500">
              {index + 1} of {queue.length}
            </p>
          )}
        </div>
        <button type="button" onClick={close} className="p-2 -mr-2 rounded-full text-gray-500 hover:bg-gray-100" aria-label="Close review">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${queue.length ? (Math.min(index, queue.length) / queue.length) * 100 : 100}%` }} />
      </div>

      {!post ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
          <PartyPopper className="w-12 h-12 text-green-500" />
          <p className="text-xl font-semibold text-gray-900">All caught up</p>
          <p className="text-sm text-gray-500">
            {decided > 0 ? `You reviewed ${decided} post${decided === 1 ? '' : 's'}. Your team has been notified.` : 'Nothing is waiting for your review right now.'}
          </p>
          <button type="button" onClick={close} className="mt-4 w-full max-w-xs h-12 rounded-xl bg-gray-900 text-white font-semibold">
            Done
          </button>
        </div>
      ) : (
        <>
          {/* Post */}
          <div className="flex-1 overflow-y-auto">
            {media.length > 0 && (
              <div className="relative bg-gray-100">
                <CarouselMedia
                  items={media}
                  index={mediaIndex}
                  alt="Post media"
                  className="w-full aspect-square [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none"
                  videoClassName="w-full aspect-square"
                />
                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                      disabled={mediaIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white disabled:opacity-0"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaIndex((i) => Math.min(media.length - 1, i + 1))}
                      disabled={mediaIndex === media.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white disabled:opacity-0"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                      {mediaIndex + 1}/{media.length}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">{formatWhen(post.scheduled_date, post.scheduled_time)}</span>
                <PlatformBadges platforms={post.platforms_scheduled} size={22} />
              </div>
              <p className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap break-words">{post.caption || 'No caption'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {requesting ? (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What should we change?"
                  rows={3}
                  autoFocus
                  className="w-full rounded-xl border border-gray-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setRequesting(false); setError(null); }}
                    disabled={submitting}
                    className="h-12 rounded-xl border border-gray-300 font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submit('needs_attention')}
                    disabled={submitting}
                    className="h-12 rounded-xl bg-orange-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequesting(true)}
                    disabled={submitting}
                    className="h-12 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => submit('approved')}
                    disabled={submitting}
                    className="h-12 rounded-xl bg-green-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                    Approve
                  </button>
                </div>
                <button type="button" onClick={next} disabled={submitting} className="w-full py-2 text-sm text-gray-500">
                  Skip for now
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
