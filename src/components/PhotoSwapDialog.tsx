'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Search, ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface GalleryItem {
  id: string;
  media_url: string;
  ai_description: string | null;
  ai_tags: string[];
  ai_mood: string | null;
  ai_categories: string[];
  times_used: number;
}

interface PhotoSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  currentMediaGalleryId?: string | null;
  onPhotoSelected: (mediaGalleryId: string) => void;
  isLoading?: boolean;
}

export default function PhotoSwapDialog({
  open,
  onOpenChange,
  clientId,
  currentMediaGalleryId,
  onPhotoSelected,
  isLoading = false,
}: PhotoSwapDialogProps) {
  const { getAccessToken } = useAuth();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const token = getAccessToken();
    fetch(`/api/media-gallery?clientId=${clientId}&limit=60&status=available`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setItems(data.items ?? data.gallery ?? []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, clientId, getAccessToken]);

  const filtered = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.ai_description?.toLowerCase().includes(q) ||
      (item.ai_tags || []).some(t => t.toLowerCase().includes(q)) ||
      (item.ai_categories || []).some(c => c.toLowerCase().includes(q)) ||
      item.ai_mood?.toLowerCase().includes(q)
    );
  });

  const handleSelect = (id: string) => {
    setSelected(id);
    onPhotoSelected(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Swap Photo</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by description, tag, mood…"
            className="pl-8 h-8 text-sm"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-blue-600 bg-blue-50 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Regenerating caption for new photo…
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No analyzed photos found. Upload and analyze photos in Media Gallery first.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map(item => {
                const isCurrent = item.id === currentMediaGalleryId;
                const isSelected = item.id === selected;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSelect(item.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all text-left group ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : isCurrent
                        ? 'border-gray-300 opacity-50 cursor-not-allowed'
                        : 'border-transparent hover:border-blue-300'
                    }`}
                    title={item.ai_description || undefined}
                  >
                    <div className="aspect-square bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.media_url}
                        alt={item.ai_description || 'Gallery photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-1 left-1 bg-gray-600 text-white text-[9px] px-1 py-0.5 rounded">
                        Current
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-gray-500 truncate">
                        {item.ai_description || item.ai_mood || 'No description'}
                      </p>
                      {item.ai_tags?.length > 0 && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {item.ai_tags.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
