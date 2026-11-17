'use client';

import { useMemo } from 'react';
import { lintCaption, type LintCheckStatus } from '@/lib/captionLint';

const STATUS_STYLES: Record<LintCheckStatus, string> = {
  PASS: 'bg-green-50 text-green-700 border-green-200',
  WARN: 'bg-amber-50 text-amber-700 border-amber-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
};

const VERDICT_STYLES: Record<'READY' | 'REVIEW' | 'FIX', string> = {
  READY: 'bg-green-100 text-green-800',
  REVIEW: 'bg-amber-100 text-amber-800',
  FIX: 'bg-red-100 text-red-800',
};

export function CaptionLintPanel({ caption }: { caption: string }) {
  const result = useMemo(() => lintCaption(caption), [caption]);

  if (!caption.trim()) {
    return <p className="text-xs text-gray-400 text-center py-4">Write a caption to see the lint.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">What the feed shows</p>
        <div className="border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 bg-gray-50 whitespace-pre-wrap break-words">
          {result.visible}
          {result.truncated && <span className="text-gray-400">… more</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        {result.checks.map((check) => (
          <div key={check.check} className="flex items-start gap-2 text-xs">
            <span
              className={`flex-shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[check.status]}`}
            >
              {check.status}
            </span>
            <span className="text-gray-600">
              <span className="font-medium text-gray-800">{check.check}</span> — {check.detail}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">
          {result.characters} / {result.limit} characters
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${VERDICT_STYLES[result.verdict]}`}>
          {result.verdict}
        </span>
      </div>
    </div>
  );
}
