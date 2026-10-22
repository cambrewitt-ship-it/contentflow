"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { encodeMention, type Mentionable } from "@/lib/mentions";
import { cn } from "@/lib/utils";

/**
 * Comment draft that remembers which people were picked from the @ menu, so the
 * textarea can show a friendly "@Sam Smith" while the saved comment carries the
 * person's id.
 */
export function useMentionDraft() {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Mentionable[]>([]);

  const addMention = useCallback((m: Mentionable) => {
    setPicked(prev => (prev.some(p => p.kind === m.kind && p.id === m.id) ? prev : [...prev, m]));
  }, []);

  const reset = useCallback(() => {
    setText("");
    setPicked([]);
  }, []);

  /** The comment text with picked "@Name"s turned into stored mention tokens. */
  const encoded = useMemo(() => {
    let out = text.trim();
    // Longest names first so "@Sam Smith" wins over "@Sam"
    for (const m of [...picked].sort((a, b) => b.name.length - a.name.length)) {
      const escaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(^|[^\\w\\]])@${escaped}(?![\\w])`, "g"), (_s, pre: string) => `${pre}${encodeMention(m)}`);
    }
    return out;
  }, [text, picked]);

  return { text, setText, addMention, reset, encoded };
}

export type MentionDraft = ReturnType<typeof useMentionDraft>;

export interface MentionTextareaHandle {
  focus: () => void;
  /** Start the draft with "@Name " (used by Reply). */
  prefillMention: (m: Mentionable) => void;
}

interface Props extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  draft: MentionDraft;
  mentionables: Mentionable[];
}

// "@que" right before the caret, at the start or after whitespace
const QUERY_RE = /(^|\s)@([^\s@]{0,30})$/;

export const MentionTextarea = forwardRef<MentionTextareaHandle, Props>(function MentionTextarea(
  { draft, mentionables, onKeyDown, className, ...rest },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ text: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return mentionables.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, mentionables]);

  const updateQuery = (value: string, caret: number) => {
    const match = QUERY_RE.exec(value.slice(0, caret));
    if (match) {
      setQuery({ text: match[2], start: caret - match[2].length - 1 });
      setActiveIndex(0);
    } else {
      setQuery(null);
    }
  };

  const insert = (m: Mentionable) => {
    const el = textareaRef.current;
    if (!el || !query) return;
    const caret = el.selectionStart ?? draft.text.length;
    const before = draft.text.slice(0, query.start);
    const after = draft.text.slice(caret);
    const insertText = `@${m.name} `;
    draft.setText(before + insertText + after);
    draft.addMention(m);
    setQuery(null);
    const pos = before.length + insertText.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    prefillMention: (m: Mentionable) => {
      const text = `@${m.name} `;
      draft.setText(text);
      draft.addMention(m);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(text.length, text.length);
      });
    },
  }));

  const open = query !== null && matches.length > 0;

  return (
    <>
      <Textarea
        {...rest}
        ref={textareaRef}
        value={draft.text}
        className={className}
        onChange={e => {
          draft.setText(e.target.value);
          updateQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onBlur={e => {
          // Let a click on a menu item land before closing
          setTimeout(() => setQuery(null), 150);
          rest.onBlur?.(e);
        }}
        onKeyDown={e => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex(i => (i + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex(i => (i - 1 + matches.length) % matches.length);
              return;
            }
            if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
              e.preventDefault();
              insert(matches[activeIndex]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQuery(null);
              return;
            }
          }
          onKeyDown?.(e);
        }}
      />
      {open && (
        <div
          role="listbox"
          className="absolute left-0 bottom-full mb-1 z-50 w-64 max-w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1"
        >
          {matches.map((m, i) => (
            <button
              key={`${m.kind}:${m.id}`}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={e => {
                e.preventDefault();
                insert(m);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm",
                i === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"
              )}
            >
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: m.color ?? "#6366f1" }}
              >
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-gray-800">{m.name}</span>
              {m.label && <span className="ml-auto text-[10px] text-gray-400 truncate">{m.label}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
});
