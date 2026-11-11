'use client';

import { use, useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Search,
  Upload,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  XCircle,
  Image as ImageIcon,
  X,
  RotateCcw,
  Archive,
  Tag,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import MediaUploadDialog from '@/components/MediaUploadDialog';

interface MediaGalleryItem {
  id: string;
  client_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  file_name: string | null;
  file_size: number | null;
  ai_tags: string[] | null;
  ai_description: string | null;
  ai_categories: string[] | null;
  ai_mood: string | null;
  ai_setting: string | null;
  ai_subjects: string[] | null;
  ai_analysis_status: 'pending' | 'analyzing' | 'complete' | 'failed';
  ai_analysis_error: string | null;
  user_tags: string[] | null;
  user_context: string | null;
  user_category: string | null;
  times_used: number;
  last_used_at: string | null;
  freshness_score: number;
  status: 'available' | 'archived' | 'cooling';
  created_at: string;
}

const CATEGORIES = [
  'Food & Drink',
  'Ambience',
  'Team & Staff',
  'Events',
  'Products',
  'Exterior',
  'Interior',
  'Behind the Scenes',
  'Seasonal',
  'Lifestyle',
  'Nature',
  'Sports',
  'User Generated',
];

const LIMIT = 50;

function AnalysisStatusBadge({ status }: { status: MediaGalleryItem['ai_analysis_status'] }) {
  if (status === 'analyzing')
    return (
      <div className="absolute top-2 left-2 rounded-full bg-gray-900/60 p-1 ring-1 ring-white/30 backdrop-blur-sm" title="Analysing">
        <Loader2 className="h-3 w-3 text-white animate-spin" />
      </div>
    );
  if (status === 'complete')
    return (
      <div className="absolute top-2 left-2 rounded-full bg-emerald-500/90 p-1 ring-1 ring-white/40 backdrop-blur-sm" title="AI analysed">
        <CheckCircle2 className="h-3 w-3 text-white" />
      </div>
    );
  if (status === 'failed')
    return (
      <div className="absolute top-2 left-2 rounded-full bg-red-500/90 p-1 ring-1 ring-white/40 backdrop-blur-sm" title="Analysis failed">
        <XCircle className="h-3 w-3 text-white" />
      </div>
    );
  return null;
}

function sortItems(items: MediaGalleryItem[], sort: string) {
  const copy = [...items];
  switch (sort) {
    case 'most-used':
      return copy.sort((a, b) => b.times_used - a.times_used);
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case 'oldest':
      return copy.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    default:
      return copy; // freshest — already ordered by API
  }
}

export default function MediaGalleryPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();

  // Data
  const [items, setItems] = useState<MediaGalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Filters
  const [status, setStatus] = useState<'available' | 'archived'>('available');
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sort, setSort] = useState('freshest');

  // UI
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaGalleryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MediaGalleryItem | null>(null);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);

  // Detail modal edit state
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [editContext, setEditContext] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Bulk analysis state
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setActiveSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchItems = async (newOffset = 0, append = false) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const token = getAccessToken();
      let url = `/api/media-gallery?clientId=${clientId}&status=${status}&limit=${LIMIT}&offset=${newOffset}`;
      if (category) url += `&category=${encodeURIComponent(category)}`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load gallery');

      setItems(prev => (append ? [...prev, ...(data.items || [])] : data.items || []));
      setTotal(data.total || 0);
      setOffset(newOffset + LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchItems(0, false); }, [clientId, status, category, activeSearch]);

  const openDetail = (item: MediaGalleryItem) => {
    setSelectedItem(item);
    setEditTags(item.user_tags || []);
    setTagInput('');
    setEditContext(item.user_context || '');
    setEditCategory(item.user_category || '');
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/media-gallery/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userTags: editTags, userContext: editContext, userCategory: editCategory }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setItems(prev => prev.map(i => (i.id === selectedItem.id ? data.item : i)));
      setSelectedItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async (item: MediaGalleryItem) => {
    setAnalyzing(true);
    try {
      const token = getAccessToken();
      const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-media`;
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ mediaId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to analyze');
      const updating = (i: MediaGalleryItem) =>
        i.id === item.id ? { ...i, ai_analysis_status: 'analyzing' as const } : i;
      setItems(prev => prev.map(updating));
      if (selectedItem?.id === item.id) setSelectedItem(prev => prev ? updating(prev) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeAll = async () => {
    setBulkAnalyzing(true);
    setBulkProgress(null);
    setError(null);

    try {
      const token = getAccessToken();

      // Fetch all unanalyzed image IDs
      const idsRes = await fetch(`/api/media-gallery?clientId=${clientId}&idsOnly=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const idsData = await idsRes.json();
      if (!idsRes.ok || !idsData.success) throw new Error(idsData.error || 'Failed to fetch image IDs');

      const ids: string[] = idsData.ids || [];
      if (ids.length === 0) {
        setBulkAnalyzing(false);
        return;
      }

      setBulkProgress({ done: 0, total: ids.length });

      // Optimistically mark all as analyzing in the UI
      setItems(prev =>
        prev.map(i => ids.includes(i.id) ? { ...i, ai_analysis_status: 'analyzing' as const } : i)
      );

      // Process with concurrency of 5
      let done = 0;
      const CONCURRENCY = 5;

      const runOne = async (id: string) => {
        try {
          const res = await fetch('/api/media-gallery/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ mediaId: id }),
          });
          const data = await res.json();
          const status = data.results?.[0]?.ai_analysis_status === 'complete' ? 'complete' : 'failed';
          setItems(prev =>
            prev.map(i => i.id === id ? { ...i, ai_analysis_status: status as const } : i)
          );
        } catch {
          setItems(prev =>
            prev.map(i => i.id === id ? { ...i, ai_analysis_status: 'failed' as const } : i)
          );
        } finally {
          done += 1;
          setBulkProgress({ done, total: ids.length });
        }
      };

      // Pool: keep CONCURRENCY requests in flight at all times
      const queue = [...ids];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          const id = queue.shift();
          if (id) await runOne(id);
        }
      });
      await Promise.all(workers);

      // Refresh to get final server state
      await fetchItems(0, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk analysis failed');
    } finally {
      setBulkAnalyzing(false);
      setBulkProgress(null);
    }
  };

  const handleArchive = async (item: MediaGalleryItem) => {
    setArchiving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/media-gallery/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to archive');
      setItems(prev => prev.filter(i => i.id !== item.id));
      setTotal(prev => prev - 1);
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  const handlePermanentDelete = async (item: MediaGalleryItem) => {
    setArchiving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/media-gallery/${item.id}?permanent=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      setItems(prev => prev.filter(i => i.id !== item.id));
      setTotal(prev => prev - 1);
      if (selectedItem?.id === item.id) setSelectedItem(null);
      setItemToDelete(null);
      setConfirmPermanentDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setArchiving(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/,/g, '');
    if (tag && !editTags.includes(tag)) setEditTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const displayItems = sortItems(items, sort);
  const hasMore = items.length < total;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">Media Gallery</h1>
            <p className="mt-1 h-5 text-[13px] text-gray-500">
              {!loading && <>{total} item{total !== 1 ? 's' : ''}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ai"
            onClick={handleAnalyzeAll}
            disabled={bulkAnalyzing || loading}
            className="h-10 rounded-xl"
          >
            {bulkAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {bulkProgress
              ? `Analysing ${bulkProgress.done}/${bulkProgress.total}...`
              : 'Analyse All Photos with AI'}
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="h-10 rounded-xl">
            <Upload className="h-4 w-4" />
            Upload Photos
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/70 bg-white/75 p-2 shadow-card backdrop-blur-xl">
        {/* Status toggle */}
        <div className="flex rounded-xl bg-gray-100/80 p-1 text-[13px]">
          <button
            onClick={() => { setStatus('available'); setOffset(0); }}
            className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
              status === 'available' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/80' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => { setStatus('archived'); setOffset(0); }}
            className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
              status === 'archived' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/80' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Archived
          </button>
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-9 rounded-xl border border-gray-200/80 bg-white px-3 text-[13px] text-gray-700 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="h-9 rounded-xl border border-gray-200/80 bg-white px-3 text-[13px] text-gray-700 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
        >
          <option value="freshest">Freshest First</option>
          <option value="most-used">Most Used</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search photos..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7" aria-busy="true">
          {Array.from({ length: 14 }).map((_, n) => (
            <div key={n} className="aspect-square animate-pulse rounded-xl bg-gray-200/50" />
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading && displayItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {displayItems.map(item => (
            <div
              key={item.id}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-gray-100 shadow-xs ring-1 ring-gray-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-blue-300"
              onClick={() => openDetail(item)}
            >
              {item.media_type === 'image' ? (
                <Image
                  src={item.media_url}
                  alt={item.file_name || 'Gallery image'}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  quality={70}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                </div>
              )}

              {/* Hover dimmer */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gray-900/55 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

              {/* AI status */}
              <AnalysisStatusBadge status={item.ai_analysis_status} />

              {/* Three-dot menu */}
              <div
                className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                onClick={e => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full bg-white/85 p-1 shadow-sm ring-1 ring-white/60 backdrop-blur-sm transition-colors hover:bg-white"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-gray-700" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openDetail(item)}>
                      <Tag className="mr-2 h-3.5 w-3.5" />
                      Edit Tags
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleReanalyze(item)}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Re-analyze
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleArchive(item)}
                      className="text-amber-600 focus:text-amber-600"
                    >
                      <Archive className="mr-2 h-3.5 w-3.5" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { setItemToDelete(item); setConfirmPermanentDelete(true); }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <X className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bottom overlay: tags + usage */}
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-wrap gap-1 items-end">
                  {(item.ai_tags || []).slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/25 backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.times_used > 0 && (
                    <span className="ml-auto rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {item.times_used}×
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayItems.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-white/90 px-6 py-16 text-center shadow-card backdrop-blur-sm">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <ImageIcon className="h-6 w-6" />
          </span>
          <h3 className="mb-1 text-[15px] font-semibold text-gray-900">
            {activeSearch || category ? 'No photos match your filters' : 'No photos yet'}
          </h3>
          <p className="mb-6 text-[13px] text-gray-500">
            {activeSearch || category
              ? 'Try adjusting your search or filters.'
              : 'Upload your first photos to get started.'}
          </p>
          {!activeSearch && !category && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Photos
            </Button>
          )}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchItems(offset, true)}
            disabled={loadingMore}
            className="rounded-xl"
          >
            {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}

      {/* Upload dialog */}
      <MediaUploadDialog
        clientId={clientId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={() => fetchItems(0, false)}
      />

      {/* Detail modal */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={open => { if (!open) setSelectedItem(null); }}
      >
        {selectedItem && (
          <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {selectedItem.file_name || 'Media Item'}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {/* Image preview */}
              <div className="flex max-h-64 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/70">
                {selectedItem.media_type === 'image' ? (
                  <Image
                    src={selectedItem.media_url}
                    alt={selectedItem.file_name || 'Media'}
                    width={640}
                    height={256}
                    className="max-h-64 w-full object-contain"
                    quality={85}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* AI data */}
              {selectedItem.ai_analysis_status === 'complete' && (
                <div className="space-y-3">
                  {selectedItem.ai_description && (
                    <div className="rounded-xl bg-gradient-to-br from-violet-50/70 to-blue-50/60 p-3 ring-1 ring-violet-100/70">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                        AI Description
                      </p>
                      <p className="text-sm text-gray-700">{selectedItem.ai_description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {selectedItem.ai_mood && (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">Mood</p>
                        <p className="text-gray-700 capitalize">{selectedItem.ai_mood}</p>
                      </div>
                    )}
                    {selectedItem.ai_setting && (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">Setting</p>
                        <p className="text-gray-700">{selectedItem.ai_setting}</p>
                      </div>
                    )}
                    {(selectedItem.ai_categories || []).length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">Category</p>
                        <p className="text-gray-700">{(selectedItem.ai_categories || []).join(', ')}</p>
                      </div>
                    )}
                  </div>
                  {(selectedItem.ai_tags || []).length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                        AI Tags
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedItem.ai_tags || []).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedItem.ai_analysis_status === 'analyzing' && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI analysis in progress...
                </div>
              )}
              {selectedItem.ai_analysis_status === 'pending' && (
                <p className="text-sm text-gray-400">AI analysis not yet started.</p>
              )}
              {selectedItem.ai_analysis_status === 'failed' && (
                <p className="text-sm text-red-500">
                  AI analysis failed.{selectedItem.ai_analysis_error ? ` ${selectedItem.ai_analysis_error}` : ''}
                </p>
              )}

              <hr className="border-gray-100" />

              {/* User tags */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                  Your Tags
                </p>
                <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                  {editTags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setEditTags(prev => prev.filter(t => t !== tag))}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add a tag and press Enter..."
                    className="h-8 text-sm"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addTag} className="h-8">
                    Add
                  </Button>
                </div>
              </div>

              {/* User context */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                  Your Notes
                </p>
                <Textarea
                  value={editContext}
                  onChange={e => setEditContext(e.target.value)}
                  placeholder="Add context or notes about this photo..."
                  className="resize-none h-20 text-sm"
                />
              </div>

              {/* User category */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                  Your Category
                </p>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-white px-3 text-[13px] text-gray-700 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
                >
                  <option value="">Uncategorised</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Usage stats */}
              <div className="space-y-3 rounded-xl bg-gray-50/80 p-3.5 ring-1 ring-gray-200/60">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">Usage Stats</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Times Used</p>
                    <p className="font-semibold text-gray-900">{selectedItem.times_used}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Last Used</p>
                    <p className="font-semibold text-gray-900">
                      {selectedItem.last_used_at
                        ? new Date(selectedItem.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400">Freshness Score</p>
                    <p className="text-xs font-medium text-gray-700">
                      {Math.round((selectedItem.freshness_score || 0) * 100)}%
                    </p>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
                      style={{ width: `${Math.min(100, (selectedItem.freshness_score || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex-col sm:flex-row gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchive(selectedItem)}
                  disabled={archiving}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  {archiving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setItemToDelete(selectedItem); setConfirmPermanentDelete(true); }}
                  disabled={archiving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {archiving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReanalyze(selectedItem)}
                  disabled={analyzing || selectedItem.ai_analysis_status === 'analyzing'}
                >
                  {analyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Re-analyze with AI
                </Button>
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmPermanentDelete} onOpenChange={setConfirmPermanentDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Image Permanently?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will permanently delete <strong>{itemToDelete?.file_name || 'this image'}</strong> and remove it from blob storage.
            </p>
            <p className="text-sm text-gray-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => { setConfirmPermanentDelete(false); setItemToDelete(null); }}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (itemToDelete) handlePermanentDelete(itemToDelete); }}
              disabled={archiving}
            >
              {archiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
