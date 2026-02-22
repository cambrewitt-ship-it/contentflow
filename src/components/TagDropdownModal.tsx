'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Tag as TagIcon, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  postId: string;
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  position?: { top: number; left: number };
}

// Predefined color palette for tags
const TAG_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export function TagDropdownModal({
  isOpen,
  onClose,
  clientId,
  postId,
  selectedTagIds,
  onTagToggle,
  position,
}: TagDropdownModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch tags for the client
  useEffect(() => {
    if (isOpen && clientId) {
      fetchTags();
    }
  }, [isOpen, clientId]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/clients/${clientId}/tags`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }

      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Authentication required');
        setIsCreating(false);
        return;
      }

      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create tag');
        return;
      }

      const data = await response.json();
      // Refresh tags list to include the new tag
      await fetchTags();
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0]);
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  // Calculate modal position - try to keep it on screen
  const getModalStyle = () => {
    if (!position) return {};
    
    const modalWidth = 320; // w-80 = 320px
    const modalHeight = 384; // max-h-96 = 384px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = position.top - modalHeight;
    let left = position.left;
    
    // Adjust if modal would go off-screen
    if (top < 0) {
      top = position.top + 30; // Show below button instead
    }
    if (left + modalWidth > viewportWidth) {
      left = viewportWidth - modalWidth - 10;
    }
    if (left < 0) {
      left = 10;
    }
    
    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 50,
    };
  };
  
  const modalStyle = getModalStyle();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-hidden flex flex-col"
        style={modalStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">Tags</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center text-sm text-gray-500 py-4">Loading tags...</div>
          ) : (
            <>
              {/* Create New Tag Section */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Create New Tag</span>
                </div>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag();
                    }
                  }}
                />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-600">Color:</span>
                  <div className="flex gap-1 flex-wrap">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newTagColor === color
                            ? 'border-gray-800 scale-110'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreating}
                  className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                >
                  {isCreating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      Create Tag
                    </>
                  )}
                </button>
              </div>

              {/* Existing Tags List */}
              <div className="space-y-1">
                {tags.length === 0 ? (
                  <div className="text-center text-xs text-gray-500 py-4">
                    No tags yet. Create one above!
                  </div>
                ) : (
                  tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTagToggle(tag.id);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-50 transition-colors text-left"
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-xs text-gray-700">{tag.name}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
