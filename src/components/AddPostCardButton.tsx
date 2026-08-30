'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddPostCardButtonProps {
  onClick: () => void;
  onNativeDrop: (e: React.DragEvent) => void;
  disabled?: boolean;
}

export function AddPostCardButton({ onClick, onNativeDrop, disabled }: AddPostCardButtonProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onNativeDrop(e);
      }}
      className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-dashed transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isDragOver
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
      }`}
    >
      <Plus className="w-4 h-4" />
      <span className="text-xs font-medium">Add post</span>
    </button>
  );
}
