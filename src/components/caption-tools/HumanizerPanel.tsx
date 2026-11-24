'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { detectHumanScore } from '@/lib/humanizer/detect';
import { humanizeText, type HumanizeReport } from '@/lib/humanizer/humanize';

const CHECK_LABELS = ['BURSTINESS', 'SPECIFICITY', 'SLOP DENSITY', 'FINGERPRINT', 'VOICE'];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}

export function HumanizerPanel({ caption, onInsert }: { caption: string; onInsert: (text: string) => void }) {
  const [report, setReport] = useState<HumanizeReport | null>(null);
  const [cleaned, setCleaned] = useState<string | null>(null);

  const detection = useMemo(() => (caption.trim() ? detectHumanScore(caption) : null), [caption]);

  const handleHumanize = () => {
    const result = humanizeText(caption);
    setCleaned(result.text.trim());
    setReport(result.report);
  };

  if (!caption.trim()) {
    return <p className="text-xs text-gray-400 text-center py-4">Write a caption to score it.</p>;
  }

  const totalChanges = report
    ? report.invisible.reduce((a, h) => a + h.count, 0) +
      report.typographic.reduce((a, h) => a + h.count, 0) +
      report.lexical.reduce((a, h) => a + h.count, 0)
    : 0;

  return (
    <div className="space-y-3">
      {detection && (
        <div className="space-y-1.5">
          {CHECK_LABELS.map((name) => {
            const check = detection.checks[name];
            if (!check) return null;
            return (
              <div key={name} className="flex items-center gap-2">
                <span className="w-24 flex-shrink-0 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {name}
                </span>
                <ScoreBar score={check.score} />
                <span className="w-10 flex-shrink-0 text-right text-[11px] text-gray-500">{check.score.toFixed(0)}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">Human score</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                detection.verdict === 'PASS'
                  ? 'bg-green-100 text-green-800'
                  : detection.verdict === 'REVIEW'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {detection.score.toFixed(1)} {detection.verdict}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleHumanize}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Wand2 className="w-3.5 h-3.5" />
        Humanize this draft
      </button>

      {cleaned && report && (
        <div className="space-y-2 border border-gray-200 rounded-lg p-2.5 bg-gray-50">
          <p className="text-[11px] text-gray-500">
            {totalChanges} machine artefact{totalChanges === 1 ? '' : 's'} removed
            {report.structures.length > 0 &&
              `, ${report.structures.length} structural tell${report.structures.length === 1 ? '' : 's'} flagged`}
          </p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{cleaned}</p>
          {report.structures.length > 0 && (
            <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc list-inside">
              {report.structures.map((s) => (
                <li key={s.name}>
                  {s.name} — {s.fix}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onInsert(cleaned)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Use cleaned version
          </button>
        </div>
      )}
    </div>
  );
}
