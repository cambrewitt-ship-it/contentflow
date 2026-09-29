'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Clapperboard,
  Grid3x3,
  SquareUser,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Ellipsis,
  ImageIcon,
  Smartphone,
  LayoutGrid,
  FileDown,
  Loader2,
} from 'lucide-react';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { isVideoUrl } from '@/lib/videoUtils';
import { normalizeTargetPlatforms } from '@/lib/targetPlatforms';

// ── Feed items ─────────────────────────────────────────────────────────────────

export interface FeedPreviewItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM[:SS]
  media: Array<{ url: string; isVideo: boolean }>;
  caption: string;
}

type AnyPost = {
  id: string;
  caption?: string | null;
  image_url?: string | null;
  media_urls?: string[] | null;
  target_platforms?: string[] | null;
  scheduled_time?: string | null;
  scheduled_date?: string;
};

type AnyUpload = {
  id: string;
  file_url: string;
  file_type?: string | null;
  notes?: string | null;
  carousel_group_id?: string | null;
  carousel_order?: number | null;
};

// Strips the "[name — role — date]:" comment lines the portal appends to upload notes
const cleanUploadNotes = (notes: string | null | undefined) =>
  (notes || '')
    .split('\n')
    .filter((line) => !/^\[.*?—.*?—.*?\]:/.test(line))
    .join('\n')
    .trim();

/**
 * Flattens the calendar's date-keyed posts and uploads into the order they'd publish in:
 * by date, then time, then their order on the day. Posts marked only for other platforms
 * are left out, since they'd never land on the Instagram grid; carousel uploads collapse
 * into one item like they do on the board.
 */
export function buildFeedPreviewItems(
  postsByDate: Record<string, AnyPost[]>,
  uploadsByDate: Record<string, AnyUpload[]> = {}
): FeedPreviewItem[] {
  const items: Array<FeedPreviewItem & { seq: number }> = [];
  let seq = 0;

  for (const [dateKey, posts] of Object.entries(postsByDate)) {
    for (const post of posts ?? []) {
      const targets = normalizeTargetPlatforms(post.target_platforms);
      if (targets.length > 0 && !targets.includes('instagram')) continue;
      const urls = (post.media_urls?.length ?? 0) > 1 ? post.media_urls! : post.image_url ? [post.image_url] : [];
      items.push({
        id: post.id,
        date: post.scheduled_date || dateKey,
        time: post.scheduled_time ?? null,
        media: urls.map((url) => ({ url, isVideo: isVideoUrl(url) })),
        caption: post.caption || '',
        seq: seq++,
      });
    }
  }

  for (const [dateKey, uploads] of Object.entries(uploadsByDate)) {
    const seenGroups = new Set<string>();
    for (const upload of uploads ?? []) {
      let group = [upload];
      if (upload.carousel_group_id) {
        if (seenGroups.has(upload.carousel_group_id)) continue;
        seenGroups.add(upload.carousel_group_id);
        group = uploads
          .filter((u) => u.carousel_group_id === upload.carousel_group_id)
          .sort((a, b) => (a.carousel_order ?? 0) - (b.carousel_order ?? 0));
      }
      items.push({
        id: `upload-${group[0].id}`,
        date: dateKey,
        time: null,
        media: group
          .filter((u) => u.file_url)
          .map((u) => ({ url: u.file_url, isVideo: u.file_type ? u.file_type.startsWith('video/') : isVideoUrl(u.file_url) })),
        caption: cleanUploadNotes(group[0].notes),
        seq: seq++,
      });
    }
  }

  return items
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
      a.seq - b.seq
    )
    .map(({ seq: _seq, ...item }) => item);
}

// ── Week helpers (weeks start on Monday, matching the calendar) ────────────────

const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDateKey = (date: Date) => date.toLocaleDateString('en-CA');

const weekStartKey = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toDateKey(date);
};

const formatWeek = (key: string) =>
  `Week of ${parseDateKey(key).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;

const formatDay = (key: string) =>
  parseDateKey(key).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });

const COUNT_OPTIONS = [3, 6, 9, 12, 15, 18, 24, 30];

type PreviewMode = 'mobile' | 'full';
const MODE_STORAGE_KEY = 'feedPreviewMode';

// ── Component ──────────────────────────────────────────────────────────────────

interface InstagramFeedPreviewProps {
  open: boolean;
  onClose: () => void;
  items: FeedPreviewItem[];
  accountName?: string;
  avatarUrl?: string | null;
}

export function InstagramFeedPreview({ open, onClose, items, accountName = '', avatarUrl }: InstagramFeedPreviewProps) {
  const weeks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = weekStartKey(item.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
  }, [items]);

  const [fromWeek, setFromWeek] = useState('');
  const [toWeek, setToWeek] = useState('');
  const [count, setCount] = useState<number | 'all'>('all');
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [mode, setModeState] = useState<PreviewMode>('mobile');
  const [exporting, setExporting] = useState(false);

  // Remember the last mode per browser
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_STORAGE_KEY) === 'full') setModeState('full');
    } catch {
      // Storage unavailable — stay on the default.
    }
  }, []);
  const setMode = (next: PreviewMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice just won't stick.
    }
  };

  // Each time it opens, default to everything from this week onwards (or all weeks if nothing's upcoming)
  useEffect(() => {
    if (!open || weeks.length === 0) return;
    const thisWeek = weekStartKey(toDateKey(new Date()));
    const firstUpcoming = weeks.find((w) => w.key >= thisWeek);
    setFromWeek(firstUpcoming ? firstUpcoming.key : weeks[0].key);
    setToWeek(weeks[weeks.length - 1].key);
    setCount('all');
    setOpenItemId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openItemId) setOpenItemId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openItemId, onClose]);

  // Items in publish order within the chosen weeks, capped to the first N
  const selected = useMemo(() => {
    const inRange = items.filter((item) => {
      const week = weekStartKey(item.date);
      return (!fromWeek || week >= fromWeek) && (!toWeek || week <= toWeek);
    });
    return count === 'all' ? inRange : inRange.slice(0, count);
  }, [items, fromWeek, toWeek, count]);

  // Instagram shows the newest post first
  const grid = useMemo(() => [...selected].reverse(), [selected]);
  const openItem = openItemId ? grid.find((i) => i.id === openItemId) ?? null : null;

  if (!open) return null;

  const handle = (accountName || 'your_brand').toLowerCase().replace(/[^a-z0-9._]+/g, '');
  const dateRange =
    selected.length > 0 ? `${formatDay(selected[0].date)} – ${formatDay(selected[selected.length - 1].date)}` : '';

  const handleExport = async () => {
    if (exporting || grid.length === 0) return;
    setExporting(true);
    try {
      // Loaded on demand so jsPDF stays out of the calendar bundle
      const { exportFeedPreviewPdf } = await import('@/lib/feedPreviewPdf');
      await exportFeedPreviewPdf({ items: grid, mode, handle, accountName, avatarUrl, dateRange });
    } catch (error) {
      console.error('Feed preview PDF export failed:', error);
      alert('Could not export the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const gridContent =
    grid.length === 0 ? (
      <div className="py-16 px-6 text-center text-sm text-gray-500">
        {items.length === 0 ? 'No posts on the calendar yet.' : 'No posts in the selected weeks.'}
      </div>
    ) : (
      <div className="grid grid-cols-3 gap-[2px]">
        {grid.map((item) => (
          <FeedTile key={item.id} item={item} onClick={() => setOpenItemId(item.id)} />
        ))}
      </div>
    );
  const selectClass =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex flex-col md:flex-row gap-6 bg-white rounded-2xl shadow-2xl p-5 md:p-6 max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Close feed preview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Controls ── */}
        <div className="w-full md:w-60 flex-shrink-0 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Instagram feed preview</h2>
            <p className="text-sm text-gray-500 mt-1">
              How the grid will look once these posts go out, in calendar order.
            </p>
          </div>

          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            {([
              ['mobile', 'Mobile view', Smartphone],
              ['full', 'Full view', LayoutGrid],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === id ? 'bg-gradient-to-r from-blue-500 to-blue-950 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {weeks.length > 0 && (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">From</span>
                <select
                  value={fromWeek}
                  onChange={(e) => {
                    setFromWeek(e.target.value);
                    if (toWeek && e.target.value > toWeek) setToWeek(e.target.value);
                  }}
                  className={selectClass}
                >
                  {weeks.map((w) => (
                    <option key={w.key} value={w.key}>
                      {formatWeek(w.key)} ({w.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">To</span>
                <select
                  value={toWeek}
                  onChange={(e) => {
                    setToWeek(e.target.value);
                    if (fromWeek && e.target.value < fromWeek) setFromWeek(e.target.value);
                  }}
                  className={selectClass}
                >
                  {weeks.map((w) => (
                    <option key={w.key} value={w.key}>
                      {formatWeek(w.key)} ({w.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Posts to include</span>
                <select
                  value={String(count)}
                  onChange={(e) => setCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className={selectClass}
                >
                  <option value="all">All posts in these weeks</option>
                  {COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      First {n} posts
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-gray-500">
                Showing {selected.length} post{selected.length === 1 ? '' : 's'}
                {dateRange && <> · {dateRange}</>}
                . Posts marked only for other platforms are left out.
              </p>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || grid.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {exporting ? 'Exporting…' : 'Export as PDF'}
              </button>
            </>
          )}
        </div>

        {mode === 'full' ? (
          /* ── Full view: just the grid ── */
          <div className="relative mx-auto w-full md:w-[560px] lg:w-[720px] h-[80vh] mt-8 md:mt-0">
            <div className="h-full overflow-y-auto rounded-lg">{gridContent}</div>
            {openItem && (
              <div
                className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center p-4"
                onClick={() => setOpenItemId(null)}
              >
                <div
                  className="w-[340px] h-[640px] max-h-full rounded-xl bg-white overflow-hidden flex flex-col shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PostView key={openItem.id} item={openItem} handle={handle} avatarUrl={avatarUrl} onBack={() => setOpenItemId(null)} />
                </div>
              </div>
            )}
          </div>
        ) : (
        /* ── Mobile view: the grid inside an Instagram profile on a phone ── */
        <div className="mx-auto flex-shrink-0 w-[340px] h-[700px] max-h-[80vh] rounded-[44px] bg-gray-900 p-2.5 shadow-xl">
          <div className="relative w-full h-full rounded-[36px] bg-white overflow-hidden flex flex-col">
            {/* Status bar */}
            <div className="flex-shrink-0 h-9 px-6 flex items-center justify-between text-[13px] font-semibold text-gray-900">
              <span>9:41</span>
              <div className="w-20 h-5 rounded-full bg-gray-900" />
              <span className="flex items-center gap-1">
                <span className="w-4 h-2.5 rounded-sm border border-gray-900 relative">
                  <span className="absolute inset-[1px] right-[3px] bg-gray-900 rounded-[1px]" />
                </span>
              </span>
            </div>

            {openItem ? (
              <PostView key={openItem.id} item={openItem} handle={handle} avatarUrl={avatarUrl} onBack={() => setOpenItemId(null)} />
            ) : (
              <>
                {/* Top bar */}
                <div className="flex-shrink-0 h-11 px-4 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[17px] font-bold text-gray-900 truncate">
                    {handle}
                    <ChevronDown className="w-4 h-4" />
                  </span>
                  <Ellipsis className="w-5 h-5 text-gray-900" />
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Profile header */}
                  <div className="px-4 pt-1 pb-3">
                    <div className="flex items-center gap-5">
                      <Avatar url={avatarUrl} name={accountName || handle} size={76} />
                      <div className="flex-1 flex justify-around text-center text-gray-900">
                        <div>
                          <div className="text-[15px] font-semibold">{selected.length}</div>
                          <div className="text-[12px]">posts</div>
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold">—</div>
                          <div className="text-[12px]">followers</div>
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold">—</div>
                          <div className="text-[12px]">following</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[13px] font-semibold text-gray-900">{accountName || handle}</div>
                    <div className="mt-3 flex gap-1.5">
                      <div className="flex-1 py-1.5 rounded-lg bg-gray-100 text-center text-[13px] font-semibold text-gray-900">Following</div>
                      <div className="flex-1 py-1.5 rounded-lg bg-gray-100 text-center text-[13px] font-semibold text-gray-900">Message</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-t border-gray-200">
                    <div className="flex-1 py-2.5 flex justify-center border-b-2 border-gray-900">
                      <Grid3x3 className="w-5 h-5 text-gray-900" />
                    </div>
                    <div className="flex-1 py-2.5 flex justify-center">
                      <Clapperboard className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 py-2.5 flex justify-center">
                      <SquareUser className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>

                  {gridContent}
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

function Avatar({ url, name, size }: { url?: string | null; name: string; size: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full bg-white p-[2px]">
        {url ? (
          <img src={url} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold" style={{ fontSize: size * 0.35 }}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaFill({ media, objectFit = 'cover' }: { media?: { url: string; isVideo: boolean }; objectFit?: 'cover' | 'contain' }) {
  if (!media) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-gray-300" />
      </div>
    );
  }
  if (media.isVideo) {
    return <VideoThumbnail src={media.url} className="w-full h-full" objectFit={objectFit} showPlayOverlay={false} />;
  }
  return <img src={media.url} alt="" loading="lazy" className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`} />;
}

function FeedTile({ item, onClick }: { item: FeedPreviewItem; onClick: () => void }) {
  const cover = item.media[0];
  return (
    // Instagram's profile grid crops to 3:4
    <button type="button" onClick={onClick} className="group relative aspect-[3/4] overflow-hidden bg-gray-100">
      <MediaFill media={cover} />
      {item.media.length > 1 ? (
        <Copy className="absolute top-1.5 right-1.5 w-4 h-4 text-white drop-shadow" />
      ) : cover?.isVideo ? (
        <Clapperboard className="absolute top-1.5 right-1.5 w-4 h-4 text-white drop-shadow" />
      ) : null}
      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent text-[10px] font-medium text-white text-left opacity-0 group-hover:opacity-100 transition-opacity">
        {formatDay(item.date)}
      </span>
    </button>
  );
}

function PostView({
  item,
  handle,
  avatarUrl,
  onBack,
}: {
  item: FeedPreviewItem;
  handle: string;
  avatarUrl?: string | null;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const total = item.media.length;

  return (
    <>
      <div className="flex-shrink-0 h-11 px-3 flex items-center gap-2">
        <button type="button" onClick={onBack} className="p-1 -ml-1 text-gray-900" aria-label="Back to grid">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-[15px] font-semibold text-gray-900">Posts</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 flex items-center gap-2">
          <Avatar url={avatarUrl} name={handle} size={32} />
          <span className="flex-1 text-[13px] font-semibold text-gray-900 truncate">{handle}</span>
          <Ellipsis className="w-5 h-5 text-gray-900" />
        </div>
        <div className="relative aspect-[4/5] bg-black">
          <MediaFill key={index} media={item.media[index]} objectFit="contain" />
          {total > 1 && (
            <>
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[11px] text-white">
                {index + 1}/{total}
              </span>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex(index - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-900" />
                </button>
              )}
              {index < total - 1 && (
                <button
                  type="button"
                  onClick={() => setIndex(index + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 text-gray-900" />
                </button>
              )}
            </>
          )}
        </div>
        <div className="px-3 pt-2.5 flex items-center gap-4 text-gray-900">
          <Heart className="w-6 h-6" />
          <MessageCircle className="w-6 h-6" />
          <Send className="w-6 h-6" />
          <Bookmark className="w-6 h-6 ml-auto" />
        </div>
        {item.caption && (
          <p className="px-3 pt-2 text-[13px] text-gray-900 whitespace-pre-wrap break-words">
            <span className="font-semibold mr-1">{handle}</span>
            {item.caption}
          </p>
        )}
        <p className="px-3 pt-1.5 pb-4 text-[11px] text-gray-500 uppercase">{formatDay(item.date)}</p>
      </div>
    </>
  );
}
