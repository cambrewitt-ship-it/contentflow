'use client';

import { useState, type ReactNode, type Ref } from 'react';
import { ArrowUp, Brain, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useSporadicGlow } from '@/hooks/useSporadicGlow';

type PromptSize = 'md' | 'sm';

// Rounded prompt box with a soft shadow and the sporadic border glow (paused while typing)
function GlowFrame({ value, boxRef, className = '', children }: {
  value: string;
  boxRef?: Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const glow = useSporadicGlow(focused && value.length > 0);
  return (
    <div
      ref={boxRef}
      className={`prompt-glow rounded-3xl shadow-[0_8px_30px_rgba(15,23,42,0.08)] ${className}`}
      data-glow={glow}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="relative flex items-end border-2 border-gray-300 rounded-3xl bg-white focus-within:border-blue-500 transition-colors">
        {children}
      </div>
    </div>
  );
}

const TEXTAREA_BASE = 'h-14 min-h-[56px] resize-none border-0 focus:outline-none focus:ring-0 shadow-none rounded-3xl pt-[18px] pb-[18px] pl-4 leading-5 flex-1';

/** Notes / instructions box with the "Generate Text" button (Standard mode, and Chat mode before the first generation). */
export function GeneratePromptBox({
  value,
  onChange,
  onGenerate,
  disabled,
  generating,
  placeholder = 'Add notes, context, or instructions for your post...',
  title,
  size = 'md',
  boxRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled: boolean;
  generating: boolean;
  placeholder?: string;
  title?: string;
  size?: PromptSize;
  boxRef?: Ref<HTMLDivElement>;
}) {
  const sm = size === 'sm';
  return (
    <GlowFrame value={value} boxRef={boxRef}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className={`${TEXTAREA_BASE} ${sm ? 'max-h-[160px] pr-32 text-sm' : 'max-h-[200px] pr-32 sm:pr-40'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!disabled) onGenerate();
          }
        }}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          title={generating ? 'Generating...' : title}
          className={`rounded-full bg-gradient-to-r from-blue-500 to-blue-950 hover:brightness-110 text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 flex items-center font-semibold ${
            sm ? 'h-8 px-4 gap-1.5 text-xs' : 'h-9 px-4 sm:px-6 gap-2 text-sm hover:scale-105'
          }`}
        >
          {generating ? (
            <>
              <RefreshCw className={`${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-spin`} />
              Generating...
            </>
          ) : (
            <>
              <Brain className={sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              <span className="sm:hidden">Generate</span>
              <span className="hidden sm:inline">Generate Text</span>
            </>
          )}
        </button>
      </div>
    </GlowFrame>
  );
}

/** Chat mode's refinement input, pinned under the conversation once captions exist. */
export function ChatRefineInput({
  value,
  onChange,
  onSend,
  sendDisabled,
  loading,
  placeholder = 'Try "make it shorter", "add a CTA", "more casual and fun"…',
  size = 'md',
  boxRef,
  hintRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  loading: boolean;
  placeholder?: string;
  size?: PromptSize;
  boxRef?: Ref<HTMLDivElement>;
  hintRef?: Ref<HTMLParagraphElement>;
}) {
  const sm = size === 'sm';
  return (
    <div>
      <GlowFrame value={value} boxRef={boxRef} className="relative z-10">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          disabled={loading}
          className={`${TEXTAREA_BASE} ${sm ? 'max-h-[160px] pr-14 text-sm' : 'max-h-[200px] pr-16'}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <div className={`absolute right-2 ${sm ? 'bottom-2.5' : 'bottom-2'}`}>
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            aria-label="Send"
            className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-950 hover:brightness-110 text-white disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center shadow-sm transition-all ${
              sm ? 'h-8 w-8' : 'h-9 w-9'
            }`}
          >
            {loading ? (
              <RefreshCw className={`${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-spin`} />
            ) : (
              <ArrowUp className={sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </GlowFrame>
      <p ref={hintRef} className={`text-center text-gray-400 mt-2 ${sm ? 'text-[11px]' : 'text-xs'}`}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
