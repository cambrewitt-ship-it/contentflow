'use client';

import { CalendarDays, FileText, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  candidates: AutopilotCandidate[];
  saving: 'drafts' | 'calendar' | null;
  error?: string | null;
  onSaveToDrafts: () => void;
  onAddToCalendar: () => void;
  onBack: () => void;
}

/**
 * Shown once every candidate has been swiped: the posts the user kept, each
 * with its photo and full caption, and the choice of where they go —
 * the Drafts list on this page, or the calendar's Unscheduled Posts bar.
 */
export default function GeneratedPostsReview({
  candidates,
  saving,
  error,
  onSaveToDrafts,
  onAddToCalendar,
  onBack,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
            {candidates.length} {candidates.length === 1 ? 'post' : 'posts'} kept
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Save them as drafts to come back to, or drop them into the calendar’s unscheduled bar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSaveToDrafts} disabled={saving !== null}>
            {saving === 'drafts' ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-1.5" />
            )}
            Save to Drafts
          </Button>
          <Button
            onClick={onAddToCalendar}
            disabled={saving !== null}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
          >
            {saving === 'calendar' ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <CalendarDays className="h-4 w-4 mr-1.5" />
            )}
            Add to Calendar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {candidates.map(c => (
          <PostCard key={c.id} candidate={c} />
        ))}
      </div>

      <button
        onClick={onBack}
        disabled={saving !== null}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
      >
        ← Back to review
      </button>
    </div>
  );
}

function PostCard({ candidate }: { candidate: AutopilotCandidate }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <img src={candidate.media_url} alt="" className="w-full aspect-square object-cover" />
      <div className="p-3 space-y-2">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.caption}</p>
        {candidate.hashtags?.length > 0 && (
          <p className="text-xs text-blue-500 break-words">{candidate.hashtags.join(' ')}</p>
        )}
      </div>
    </div>
  );
}
