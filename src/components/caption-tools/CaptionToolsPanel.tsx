'use client';

import { useState } from 'react';
import { CaptionLintPanel } from './CaptionLintPanel';
import { HumanizerPanel } from './HumanizerPanel';
import { HookWriterPanel } from './HookWriterPanel';

type Tab = 'hooks' | 'lint' | 'humanize';

const TABS: { id: Tab; label: string }[] = [
  { id: 'hooks', label: 'Hooks' },
  { id: 'lint', label: 'Lint' },
  { id: 'humanize', label: 'Humanize' },
];

interface CaptionToolsPanelProps {
  caption: string;
  onInsert: (text: string) => void;
  clientId: string;
}

export function CaptionToolsPanel({ caption, onInsert, clientId }: CaptionToolsPanelProps) {
  const [tab, setTab] = useState<Tab>('lint');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 p-1 bg-gray-50 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === 'lint' && <CaptionLintPanel caption={caption} />}
        {tab === 'humanize' && <HumanizerPanel caption={caption} onInsert={onInsert} />}
        {tab === 'hooks' && <HookWriterPanel clientId={clientId} caption={caption} onInsert={onInsert} />}
      </div>
    </div>
  );
}
