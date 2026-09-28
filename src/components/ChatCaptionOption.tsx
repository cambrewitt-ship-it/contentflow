'use client';

import { useEffect, useRef } from 'react';
import { Check, Pencil } from 'lucide-react';

interface ChatCaptionOptionProps {
  text: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (text: string) => void;
  size?: 'sm' | 'md';
}

/**
 * A caption option produced in chat mode. Click to select it; once selected it
 * becomes an inline editable textarea so the user can tweak the AI's wording.
 */
export function ChatCaptionOption({ text, selected, onSelect, onChange, size = 'md' }: ChatCaptionOptionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, selected]);

  const textClass = size === 'sm' ? 'text-xs' : 'text-sm text-gray-800 leading-relaxed';
  const padClass = size === 'sm' ? 'px-3 py-2' : 'p-3';

  if (selected) {
    return (
      <div className={`relative rounded-xl border border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/20 ${size === 'sm' ? 'rounded-lg' : ''}`}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          aria-label="Edit caption"
          className={`block w-full resize-none overflow-hidden bg-transparent focus:outline-none text-gray-900 whitespace-pre-wrap ${textClass} ${padClass} pb-8`}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-blue-500">
            <Pencil className="w-2.5 h-2.5" /> Editable
          </span>
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700"
            title="Deselect"
          >
            <Check className="w-3 h-3" /> Selected
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${size === 'sm' ? 'rounded-lg text-gray-600' : ''} ${padClass}`}
    >
      <span className={`block whitespace-pre-wrap ${textClass}`}>{text}</span>
      <span className="mt-1.5 block text-[10px] font-medium text-gray-400 group-hover:text-blue-600">
        Click to select &amp; edit
      </span>
    </button>
  );
}
