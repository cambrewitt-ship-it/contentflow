'use client';

import { useEffect, useState } from 'react';
import { Check, ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { MediaGalleryItem } from '@/types/autopilot';

/**
 * The client's gallery photos the Content Agent can use — images that have
 * finished AI analysis — plus a count of the ones still waiting on analysis.
 */
export function useAgentPhotos(clientId: string, enabled = true) {
  const { getAccessToken } = useAuth();
  const [photos, setPhotos] = useState<MediaGalleryItem[]>([]);
  const [unanalyzedCount, setUnanalyzedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`/api/media-gallery?clientId=${clientId}&limit=200`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load photos');
        const images = (data.items as MediaGalleryItem[]).filter(i => i.media_type === 'image');
        if (cancelled) return;
        // The agent only works with analyzed photos, so only those are selectable
        setPhotos(images.filter(i => i.ai_analysis_status === 'complete'));
        setUnanalyzedCount(images.filter(i => i.ai_analysis_status !== 'complete').length);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, getAccessToken, enabled]);

  return { photos, unanalyzedCount, loading, error };
}

interface AgentPhotoGridProps {
  photos: MediaGalleryItem[];
  unanalyzedCount: number;
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Tailwind classes for the scrolling grid (columns + max height). */
  gridClassName?: string;
}

/** Tick-to-select grid of the photos the agent can use. */
export default function AgentPhotoGrid({
  photos,
  unanalyzedCount,
  loading,
  error,
  selected,
  onChange,
  gridClassName = 'grid-cols-4 sm:grid-cols-5 max-h-80',
}: AgentPhotoGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (photos.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <ImageIcon className="h-8 w-8 text-gray-200 mx-auto" />
        <p className="text-sm text-gray-400">No analyzed photos yet.</p>
        <p className="text-xs text-gray-300">Upload and analyze photos in the media gallery first.</p>
      </div>
    );
  }

  // Ids of photos deleted/archived since they were picked don't count
  const selectedCount = photos.filter(p => selected.has(p.id)).length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{selectedCount}</span> of {photos.length} selected
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(new Set(photos.map(p => p.id)))}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      </div>
      <div className={`grid gap-1.5 overflow-y-auto pr-1 ${gridClassName}`}>
        {photos.map(photo => {
          const isSelected = selected.has(photo.id);
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => toggle(photo.id)}
              aria-pressed={isSelected}
              title={photo.ai_description ?? photo.file_name ?? undefined}
              className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                isSelected ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span
                className={`absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center border ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white/80 border-gray-300'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </span>
              {photo.times_used > 0 && (
                <span className="absolute bottom-1 left-1 px-1 rounded bg-black/60 text-[10px] text-white">
                  used {photo.times_used}×
                </span>
              )}
            </button>
          );
        })}
      </div>
      {unanalyzedCount > 0 && (
        <p className="text-[11px] text-gray-400">
          {unanalyzedCount} photo{unanalyzedCount === 1 ? '' : 's'} not shown — analyze them in the media gallery to
          make them selectable.
        </p>
      )}
    </div>
  );
}
