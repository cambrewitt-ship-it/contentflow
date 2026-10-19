'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const DEFAULT_STEPS = [
  'Reading your brand voice…',
  'Looking at the post…',
  'Drafting captions…',
  'Tightening the wording…',
  'Almost there…',
];

interface ThinkingIndicatorProps {
  steps?: string[];
  size?: 'sm' | 'md';
}

/**
 * Shimmering status text that steps through what the AI is doing while captions
 * generate. Holds on the last step rather than looping, so a slow request doesn't
 * cycle back to "Reading your brand voice…".
 */
export function ThinkingIndicator({ steps = DEFAULT_STEPS, size = 'md' }: ThinkingIndicatorProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= steps.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 2200);
    return () => clearTimeout(timer);
  }, [step, steps.length]);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <Sparkles className={`${iconSize} text-blue-500 animate-pulse shrink-0`} />
      <span key={step} className={`thinking-shimmer thinking-step-in ${textSize} font-medium`}>
        {steps[step]}
      </span>
    </div>
  );
}
