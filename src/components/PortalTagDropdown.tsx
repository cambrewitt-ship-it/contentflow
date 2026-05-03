'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Check } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface PortalTagDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  portalToken: string;
  postId: string;
  selectedTagIds: string[];
  onTagToggle: (tagId: string, tag: Tag, isSelected: boolean) => void;
  position?: { top: number; left: number };
}

const TAG_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export function PortalTagDropdown({
  isOpen,
  onClose,
  portalToken,
  postId,
  selectedTagIds,
  onTagToggle,
  position,
}: PortalTagDropdownProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) fetchTags();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/tags?portal_token=${encodeURIComponent(portalToken)}`);
      const data = await res.json();
      if (res.ok) setTags(data.tags ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/portal/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_token: portalToken, name: newTagName.trim(), color: newTagColor }),
      });
      if (res.ok) {
        await fetchTags();
        setNewTagName('');
        setNewTagColor(TAG_COLORS[0]);
        setShowCreate(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const getModalStyle = () => {
    const modalWidth = 280;
    const modalHeight = 360;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!position) {
      return { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 };
    }

    let top = position.top - modalHeight - 8;
    let left = position.left;
    if (top < 8) top = position.top + 8;
    if (left + modalWidth > vw - 8) left = vw - modalWidth - 8;
    if (left < 8) left = 8;
    if (top + modalHeight > vh - 8) top = vh - modalHeight - 8;

    return { position: 'fixed' as const, top: `${top}px`, left: `${left}px`, zIndex: 9999 };
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-70 overflow-hidden flex flex-col"
        style={{ ...getModalStyle(), width: 280 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tags</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-48">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
          ) : tags.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No tags yet</p>
          ) : (
            tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onTagToggle(tag.id, tag, isSelected)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-xs text-gray-700">{tag.name}</span>
                  {isSelected && <Check className="w-3 h-3 text-gray-500 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Create new tag */}
        <div className="border-t border-gray-100 p-2">
          {showCreate ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') setShowCreate(false); }}
                placeholder="Tag name"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                autoFocus
              />
              <div className="flex flex-wrap gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newTagColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={isCreating || !newTagName.trim()}
                  className="flex-1 py-1 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {isCreating ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New tag
            </button>
          )}
        </div>
      </div>
    </>
  );
}
