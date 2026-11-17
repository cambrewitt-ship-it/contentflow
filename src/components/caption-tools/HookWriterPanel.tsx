'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ScoredHook {
  formulaId: number;
  formulaName: string;
  spoken: string;
  onScreen: string;
  score: number;
  verdict: 'STRONG' | 'OK' | 'WEAK';
  weakest: string;
  flags: string[];
}

const VERDICT_STYLES: Record<ScoredHook['verdict'], string> = {
  STRONG: 'bg-green-100 text-green-800',
  OK: 'bg-amber-100 text-amber-800',
  WEAK: 'bg-red-100 text-red-800',
};

interface HookWriterPanelProps {
  clientId: string;
  caption: string;
  onInsert: (text: string) => void;
}

export function HookWriterPanel({ clientId, caption, onInsert }: HookWriterPanelProps) {
  const { getAccessToken } = useAuth();
  const [topic, setTopic] = useState('');
  const [hooks, setHooks] = useState<ScoredHook[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/ai-assist/hook-writer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, topic: topic.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Could not generate hooks');
        return;
      }
      setHooks(data.hooks);
    } catch {
      setError('Could not generate hooks');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGenerate();
          }}
          placeholder="What's this post about?"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!topic.trim() || isGenerating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Write hooks
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hooks.length === 0 && !isGenerating && !error && (
        <p className="text-xs text-gray-400 text-center py-4">
          Ranked hooks from 26 formulas, scored on length, specificity, stakes, frontloading and who it&apos;s aimed at.
        </p>
      )}

      <div className="space-y-2">
        {hooks.map((hook, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{hook.formulaName}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${VERDICT_STYLES[hook.verdict]}`}>
                {hook.score.toFixed(0)} {hook.verdict}
              </span>
            </div>
            <p className="text-xs text-gray-800">{hook.spoken}</p>
            <p className="text-[11px] text-gray-400">On screen: {hook.onScreen}</p>
            {hook.flags.length > 0 && <p className="text-[11px] text-red-600">{hook.flags[0]}</p>}
            <button
              type="button"
              onClick={() => onInsert(caption.trim() ? `${hook.spoken}\n\n${caption}` : hook.spoken)}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
            >
              Use this
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
