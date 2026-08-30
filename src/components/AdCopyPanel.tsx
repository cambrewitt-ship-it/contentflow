'use client';

import { useState, useCallback } from 'react';
import { Check, Copy, Megaphone, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  candidates: AutopilotCandidate[];
}

type EditField = 'ad_headline' | 'ad_primary_text' | 'ad_description';

function buildClipboardText(c: AutopilotCandidate): string {
  const lines = [c.ad_headline, c.ad_primary_text, c.ad_description].filter(Boolean);
  return lines.join('\n\n');
}

function AdCopyCard({ candidate: initial }: { candidate: AutopilotCandidate }) {
  const { getAccessToken } = useAuth();
  const [candidate, setCandidate] = useState(initial);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(candidate.ad_status === 'copied');

  const saveField = useCallback(
    async (field: EditField, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setEditingField(null);
        return;
      }
      setCandidate(prev => ({ ...prev, [field]: trimmed }));
      setEditingField(null);

      const token = getAccessToken();
      if (token) {
        fetch(`/api/autopilot/candidates/${candidate.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: trimmed }),
        }).catch(() => {});
      }
    },
    [candidate.id, getAccessToken]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildClipboardText(candidate));
    } catch {
      // clipboard API can fail in insecure contexts / permissions — the text
      // is still visible on the card for manual copy
    }
    setCopied(true);
    const token = getAccessToken();
    if (token) {
      fetch(`/api/autopilot/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_status: 'copied' }),
      }).catch(() => {});
    }
  };

  const startEdit = (field: EditField) => {
    setEditingField(field);
    setDraft(candidate[field] ?? '');
  };

  function EditableField({ field, label, value }: { field: EditField; label: string; value: string | null }) {
    const isEditing = editingField === field;
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
        {isEditing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => saveField(field, draft)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveField(field, draft);
              if (e.key === 'Escape') setEditingField(null);
            }}
            autoFocus
            rows={field === 'ad_primary_text' ? 3 : 2}
            className="w-full text-sm border border-blue-300 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : (
          <div className="group relative">
            <p className={`text-sm pr-5 ${field === 'ad_headline' ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              {value}
            </p>
            <button
              onClick={() => startEdit(field)}
              className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title={`Edit ${label.toLowerCase()}`}
            >
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex">
        <img src={candidate.media_url} alt="" className="w-24 h-auto object-cover flex-shrink-0" />
        <div className="flex-1 p-3 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full capitalize">
              {candidate.ad_platform === 'google' ? 'Google Ads' : 'Meta Ads'}
            </span>
          </div>
          <EditableField field="ad_headline" label="Headline" value={candidate.ad_headline} />
          <EditableField field="ad_primary_text" label="Primary text" value={candidate.ad_primary_text} />
          {candidate.ad_description && (
            <EditableField field="ad_description" label="Description" value={candidate.ad_description} />
          )}
        </div>
      </div>
      <div className="border-t border-gray-100 px-3 py-2 flex justify-end">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            copied ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}

export default function AdCopyPanel({ candidates }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-800">
          {candidates.length} ad copy variant{candidates.length !== 1 ? 's' : ''}
        </h3>
        <span className="text-xs text-gray-400">— paste into Ads Manager, not scheduled to the calendar</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {candidates.map(c => (
          <AdCopyCard key={c.id} candidate={c} />
        ))}
      </div>
    </div>
  );
}
