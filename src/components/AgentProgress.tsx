'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

// The generate endpoint returns in one shot, so progress is estimated from how
// long recent runs took. The bar eases toward ~95% over the expected duration,
// then creeps slowly so it never sits "full" while the agent is still working.

const DURATIONS_KEY = 'contentAgent:runDurations';
const DEFAULT_DURATION_MS = 120_000;
const MAX_SAMPLES = 5;

const STEPS = [
  'Thinking',
  'Reading tone of voice',
  'Reviewing brand guidelines',
  'Analysing media library',
  'Checking recent posts',
  'Checking upcoming dates',
  'Looking at local events',
  'Learning your style preferences',
  'Drafting post ideas',
  'Writing captions',
  'Critiquing drafts',
  'Polishing the shortlist',
];
const STEP_INTERVAL_MS = 3500;

function readDurations(): number[] {
  try {
    const raw = localStorage.getItem(DURATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'number' && n > 0) : [];
  } catch {
    return [];
  }
}

export function recordAgentRunDuration(ms: number) {
  try {
    const next = [...readDurations(), ms].slice(-MAX_SAMPLES);
    localStorage.setItem(DURATIONS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — estimates fall back to the default
  }
}

function expectedDuration(): number {
  const samples = readDurations();
  if (samples.length === 0) return DEFAULT_DURATION_MS;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

function progressFor(elapsed: number, expected: number): number {
  const t = elapsed / expected;
  if (t <= 1) {
    // ease-out to 95% at the expected finish
    return 95 * (1 - Math.pow(1 - t, 2));
  }
  // overtime: approach 99% asymptotically
  return 95 + 4 * (1 - Math.exp(-(t - 1) * 2));
}

export default function AgentProgress({ startedAt }: { startedAt: number }) {
  const [expected] = useState(expectedDuration);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const progress = progressFor(elapsed, expected);

  // Walk through the steps once, then keep cycling the later "writing" steps.
  const rawStep = Math.floor(elapsed / STEP_INTERVAL_MS);
  const loopStart = STEPS.indexOf('Drafting post ideas');
  const stepIndex =
    rawStep < STEPS.length
      ? rawStep
      : loopStart + ((rawStep - STEPS.length) % (STEPS.length - loopStart));
  const step = STEPS[stepIndex];

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-purple-400" />
        </div>
        <Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-purple-300" />
      </div>

      <div className="text-center">
        <p className="font-medium text-gray-700">Your AI agent is researching and drafting…</p>
        <p key={step} className="text-sm text-purple-500 mt-1 animate-agent-step">
          {step}…
        </p>
      </div>

      <div className="w-64 space-y-1.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-[width] duration-300 ease-linear overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 animate-agent-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        </div>
        <div className="text-xs text-gray-400">{Math.floor(progress)}%</div>
      </div>

      <style jsx global>{`
        .animate-agent-step {
          animation: agent-step-in 400ms ease-out;
        }
        .animate-agent-shimmer {
          animation: agent-shimmer 1.6s linear infinite;
        }
        @keyframes agent-step-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agent-shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
