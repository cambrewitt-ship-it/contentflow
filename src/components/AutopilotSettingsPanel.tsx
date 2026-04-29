'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  Check,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Brain,
  Trash2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Client,
  OperatingHours,
  PostingPreferences,
  BusinessContext,
  AutopilotSettings,
  ContentMix,
} from '@/types/api';
import type { StylePreferences } from '@/types/autopilot';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};
const DAY_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'bar', label: 'Bar' },
  { value: 'retail', label: 'Retail' },
  { value: 'service', label: 'Service Business' },
  { value: 'fitness', label: 'Fitness / Gym' },
  { value: 'beauty', label: 'Beauty / Salon' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'creative', label: 'Creative / Agency' },
  { value: 'other', label: 'Other' },
];

const BUSINESS_ATTRIBUTES = [
  { key: 'has_live_sport', label: 'Has live sport' },
  { key: 'outdoor_seating', label: 'Outdoor seating' },
  { key: 'seasonal_menu', label: 'Seasonal menu' },
  { key: 'delivery_available', label: 'Delivery available' },
  { key: 'online_booking', label: 'Online booking' },
  { key: 'events_functions', label: 'Events / functions' },
  { key: 'live_music', label: 'Live music' },
];

const CONTENT_MIX_KEYS: (keyof ContentMix)[] = ['promotional', 'engagement', 'seasonal', 'educational'];
const CONTENT_MIX_LABELS: Record<keyof ContentMix, string> = {
  promotional: 'Promotional',
  engagement: 'Engagement',
  seasonal: 'Seasonal',
  educational: 'Educational',
};

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: null,
  sunday: null,
};

const DEFAULT_POSTING_PREFS: PostingPreferences = {
  posts_per_week: 3,
  preferred_days: ['monday', 'wednesday', 'friday'],
  preferred_times: ['09:00'],
  avoid_days: [],
  content_mix: { promotional: 30, engagement: 40, seasonal: 20, educational: 10 },
};

const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  business_type: 'restaurant',
  hemisphere: 'northern',
  attributes: [],
  key_offerings: [],
  local_sports_teams: [],
};

const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  auto_generate: false,
  generation_day: 'sunday',
  planning_horizon_days: 7,
  require_approval: true,
  notification_method: 'email',
  auto_publish: false,
  auto_publish_hours: 48,
};

type Section = 'operating-hours' | 'posting-preferences' | 'business-context' | 'autopilot-control' | 'style-preferences';

interface SaveState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

interface AutopilotSettingsPanelProps {
  clientId: string;
  client: Client;
  onUpdate?: (updated: Client) => void;
}

function useSectionSave(clientId: string, getAccessToken: () => string | null) {
  const [saveState, setSaveState] = useState<SaveState>({ loading: false, success: false, error: null });

  const save = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaveState({ loading: true, success: false, error: null });
      try {
        const token = getAccessToken();
        const res = await fetch(`/api/clients/${clientId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
        setSaveState({ loading: false, success: true, error: null });
        setTimeout(() => setSaveState(s => ({ ...s, success: false })), 2500);
        return data.client as Client;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save';
        setSaveState({ loading: false, success: false, error: msg });
        setTimeout(() => setSaveState(s => ({ ...s, error: null })), 4000);
        return null;
      }
    },
    [clientId, getAccessToken]
  );

  return { saveState, save };
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-0 text-left font-semibold text-gray-900 hover:text-gray-700 transition-colors"
    >
      {title}
      {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <Button size="sm" onClick={onClick} disabled={state.loading}>
        {state.loading ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving...</>
        ) : (
          'Save'
        )}
      </Button>
      {state.success && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />Saved
        </span>
      )}
      {state.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />{state.error}
        </span>
      )}
    </div>
  );
}

// ── Section A: Operating Hours ────────────────────────────────────────────────

function OperatingHoursSection({
  clientId,
  initial,
  onSaved,
}: {
  clientId: string;
  initial?: OperatingHours;
  onSaved: (client: Client) => void;
}) {
  const { getAccessToken } = useAuth();
  const { saveState, save } = useSectionSave(clientId, getAccessToken);
  const [hours, setHours] = useState<OperatingHours>(initial ?? DEFAULT_OPERATING_HOURS);

  const toggleDay = (day: string) => {
    setHours(prev => ({
      ...prev,
      [day]: prev[day] ? null : { open: '09:00', close: '17:00' },
    }));
  };

  const updateTime = (day: string, field: 'open' | 'close', value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day]!, [field]: value } : { open: '09:00', close: '17:00', [field]: value },
    }));
  };

  const handleSave = async () => {
    const client = await save({ operating_hours: hours });
    if (client) onSaved(client);
  };

  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const isOpen = !!hours[day];
        return (
          <div key={day} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleDay(day)}
              className={`flex items-center gap-2 w-28 px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                isOpen
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              {DAY_FULL[day]}
            </button>
            {isOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours[day]?.open || '09:00'}
                  onChange={e => updateTime(day, 'open', e.target.value)}
                  className="h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="time"
                  value={hours[day]?.close || '17:00'}
                  onChange={e => updateTime(day, 'close', e.target.value)}
                  className="h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <span className="text-xs text-gray-400">Closed</span>
            )}
          </div>
        );
      })}
      <SaveButton state={saveState} onClick={handleSave} />
    </div>
  );
}

// ── Section B: Posting Preferences ───────────────────────────────────────────

function PostingPreferencesSection({
  clientId,
  initial,
  onSaved,
}: {
  clientId: string;
  initial?: PostingPreferences;
  onSaved: (client: Client) => void;
}) {
  const { getAccessToken } = useAuth();
  const { saveState, save } = useSectionSave(clientId, getAccessToken);
  const [prefs, setPrefs] = useState<PostingPreferences>(initial ?? DEFAULT_POSTING_PREFS);
  const [newTime, setNewTime] = useState('');
  const [mixError, setMixError] = useState<string | null>(null);

  const toggleDay = (field: 'preferred_days' | 'avoid_days', day: string) => {
    setPrefs(prev => ({
      ...prev,
      [field]: prev[field].includes(day)
        ? prev[field].filter(d => d !== day)
        : [...prev[field], day],
    }));
  };

  const addTime = () => {
    if (!newTime || prefs.preferred_times.includes(newTime)) return;
    setPrefs(prev => ({ ...prev, preferred_times: [...prev.preferred_times, newTime].sort() }));
    setNewTime('');
  };

  const removeTime = (t: string) => {
    setPrefs(prev => ({ ...prev, preferred_times: prev.preferred_times.filter(x => x !== t) }));
  };

  const updateMix = (key: keyof ContentMix, raw: number) => {
    const value = Math.max(0, Math.min(100, raw));
    setPrefs(prev => {
      const next = { ...prev.content_mix, [key]: value };
      // Adjust the last key (educational) if total exceeds 100
      const keys = CONTENT_MIX_KEYS;
      const lastKey = keys[keys.length - 1];
      if (key !== lastKey) {
        const othersSum = keys.filter(k => k !== lastKey).reduce((s, k) => s + next[k], 0);
        next[lastKey] = Math.max(0, 100 - othersSum);
      }
      return { ...prev, content_mix: next };
    });
  };

  const mixTotal = CONTENT_MIX_KEYS.reduce((s, k) => s + prefs.content_mix[k], 0);

  const handleSave = async () => {
    if (mixTotal !== 100) {
      setMixError(`Content mix must total 100% (currently ${mixTotal}%)`);
      return;
    }
    setMixError(null);
    const client = await save({ posting_preferences: prefs });
    if (client) onSaved(client);
  };

  return (
    <div className="space-y-5">
      {/* Posts per week */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Posts per week</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={7}
            value={prefs.posts_per_week}
            onChange={e => setPrefs(prev => ({ ...prev, posts_per_week: parseInt(e.target.value) }))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-semibold text-gray-900 w-6 text-center">{prefs.posts_per_week}</span>
        </div>
      </div>

      {/* Preferred days */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Preferred posting days</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay('preferred_days', day)}
              className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${
                prefs.preferred_days.includes(day)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred times */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Preferred posting times</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {prefs.preferred_times.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
              <Clock className="h-2.5 w-2.5" />
              {t}
              <button type="button" onClick={() => removeTime(t)} className="hover:text-blue-900">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTime}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
      </div>

      {/* Avoid days */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Days to avoid</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay('avoid_days', day)}
              className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${
                prefs.avoid_days.includes(day)
                  ? 'bg-red-100 border-red-300 text-red-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-red-200'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      {/* Content mix */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-2">
          Content mix{' '}
          <span className={`ml-1 font-semibold ${mixTotal === 100 ? 'text-green-600' : 'text-red-600'}`}>
            ({mixTotal}%)
          </span>
        </label>
        <div className="space-y-3">
          {CONTENT_MIX_KEYS.map(key => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-24 flex-shrink-0">{CONTENT_MIX_LABELS[key]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={prefs.content_mix[key]}
                onChange={e => updateMix(key, parseInt(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs font-semibold text-gray-900 w-8 text-right">{prefs.content_mix[key]}%</span>
            </div>
          ))}
        </div>
        {mixError && <p className="text-xs text-red-600 mt-1">{mixError}</p>}
      </div>

      <SaveButton state={saveState} onClick={handleSave} />
    </div>
  );
}

// ── Section C: Business Context ───────────────────────────────────────────────

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
        />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={add}>
          <Plus className="h-3 w-3 mr-1" />Add
        </Button>
      </div>
    </div>
  );
}

function BusinessContextSection({
  clientId,
  initial,
  onSaved,
}: {
  clientId: string;
  initial?: BusinessContext;
  onSaved: (client: Client) => void;
}) {
  const { getAccessToken } = useAuth();
  const { saveState, save } = useSectionSave(clientId, getAccessToken);
  const [ctx, setCtx] = useState<BusinessContext>(initial ?? DEFAULT_BUSINESS_CONTEXT);

  const toggleAttribute = (key: string) => {
    setCtx(prev => ({
      ...prev,
      attributes: prev.attributes.includes(key)
        ? prev.attributes.filter(a => a !== key)
        : [...prev.attributes, key],
    }));
  };

  const handleSave = async () => {
    const client = await save({ business_context: ctx });
    if (client) onSaved(client);
  };

  return (
    <div className="space-y-5">
      {/* Business type */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Business type</label>
        <Select value={ctx.business_type} onValueChange={v => setCtx(prev => ({ ...prev, business_type: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map(bt => (
              <SelectItem key={bt.value} value={bt.value} className="text-xs">{bt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hemisphere */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Hemisphere</label>
        <Select value={ctx.hemisphere} onValueChange={v => setCtx(prev => ({ ...prev, hemisphere: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="northern" className="text-xs">Northern (UK, US, Europe…)</SelectItem>
            <SelectItem value="southern" className="text-xs">Southern (NZ, Australia, SA…)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key attributes */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-2">Key attributes</label>
        <div className="grid grid-cols-2 gap-1.5">
          {BUSINESS_ATTRIBUTES.map(attr => (
            <button
              key={attr.key}
              type="button"
              onClick={() => toggleAttribute(attr.key)}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded border transition-colors text-left ${
                ctx.attributes.includes(attr.key)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center ${
                ctx.attributes.includes(attr.key) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
              }`}>
                {ctx.attributes.includes(attr.key) && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              {attr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key offerings */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Key offerings</label>
        <TagInput
          values={ctx.key_offerings}
          onChange={v => setCtx(prev => ({ ...prev, key_offerings: v }))}
          placeholder="e.g. Craft beer, Burgers…"
        />
      </div>

      {/* Local sports teams */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1.5">Local sports teams to follow</label>
        <TagInput
          values={ctx.local_sports_teams}
          onChange={v => setCtx(prev => ({ ...prev, local_sports_teams: v }))}
          placeholder="e.g. All Blacks, Blues…"
        />
      </div>

      <SaveButton state={saveState} onClick={handleSave} />
    </div>
  );
}

// ── Section D: Autopilot Control ─────────────────────────────────────────────

function AutopilotControlSection({
  clientId,
  initialEnabled,
  initialSettings,
  onSaved,
}: {
  clientId: string;
  initialEnabled?: boolean;
  initialSettings?: AutopilotSettings;
  onSaved: (client: Client) => void;
}) {
  const { getAccessToken } = useAuth();
  const { saveState, save } = useSectionSave(clientId, getAccessToken);
  const [enabled, setEnabled] = useState(initialEnabled ?? false);
  const [settings, setSettings] = useState<AutopilotSettings>(initialSettings ?? DEFAULT_AUTOPILOT_SETTINGS);

  const handleSave = async () => {
    const client = await save({ autopilot_enabled: enabled, autopilot_settings: settings });
    if (client) onSaved(client);
  };

  return (
    <div className="space-y-5">
      {/* Master toggle */}
      <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
        enabled ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}>
        <div>
          <p className={`text-sm font-semibold ${enabled ? 'text-blue-900' : 'text-gray-700'}`}>
            Enable Autopilot
          </p>
          <p className={`text-xs mt-0.5 ${enabled ? 'text-blue-700' : 'text-gray-500'}`}>
            {enabled ? 'Autopilot will generate and plan content automatically' : 'Autopilot is disabled'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(v => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Settings — only show when enabled */}
      {enabled && (
        <div className="space-y-4 pl-1">
          {/* Generation day */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Generation day</label>
            <Select
              value={settings.generation_day}
              onValueChange={v => setSettings(prev => ({ ...prev, generation_day: v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(day => (
                  <SelectItem key={day} value={day} className="text-xs capitalize">{DAY_FULL[day]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Planning horizon */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Planning horizon</label>
            <Select
              value={String(settings.planning_horizon_days)}
              onValueChange={v => setSettings(prev => ({ ...prev, planning_horizon_days: parseInt(v) }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="text-xs">1 week</SelectItem>
                <SelectItem value="14" className="text-xs">2 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Require approval */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-700">Require approval</p>
              <p className="text-[11px] text-gray-500">Strongly recommended — review content before it goes live</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, require_approval: !prev.require_approval }))}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                settings.require_approval ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  settings.require_approval ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Notification method */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Notification method</label>
            <Select
              value={settings.notification_method}
              onValueChange={v => setSettings(prev => ({ ...prev, notification_method: v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email" className="text-xs">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto-publish timeout */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700">Auto-publish if not reviewed</p>
                <p className="text-[11px] text-gray-500">Disabled by default — use with caution</p>
              </div>
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, auto_publish: !prev.auto_publish }))}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  settings.auto_publish ? 'bg-orange-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                    settings.auto_publish ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {settings.auto_publish && (
              <div className="flex items-center gap-2 pl-0">
                <span className="text-xs text-gray-600">Auto-publish after</span>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={settings.auto_publish_hours}
                  onChange={e =>
                    setSettings(prev => ({ ...prev, auto_publish_hours: parseInt(e.target.value) || 48 }))
                  }
                  className="h-7 w-16 text-xs text-center"
                />
                <span className="text-xs text-gray-600">hours without review</span>
              </div>
            )}
          </div>
        </div>
      )}

      <SaveButton state={saveState} onClick={handleSave} />
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

function PreferenceStatsSection({ clientId }: { clientId: string }) {
  const { getAccessToken } = useAuth();
  const [prefs, setPrefs] = useState<StylePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getAccessToken();
    try {
      const res = await fetch(`/api/autopilot/preferences?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      if (data.success) setPrefs(data.preferences as StylePreferences);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId, getAccessToken]);

  const handleReset = async () => {
    if (!confirm('Reset all style preferences? This cannot be undone.')) return;
    setResetting(true);
    const token = getAccessToken();
    try {
      await fetch(`/api/autopilot/preferences?clientId=${clientId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      setPrefs(null);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    } catch {
      // silent
    } finally {
      setResetting(false);
    }
  };

  // Load on mount
  useState(() => { load(); });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const noData = !prefs || (prefs.totalLiked === 0 && prefs.totalDisliked === 0);

  return (
    <div className="space-y-4 pb-4">
      {noData ? (
        <div className="text-center py-8 space-y-2">
          <Brain className="h-8 w-8 text-gray-200 mx-auto" />
          <p className="text-sm text-gray-400">No preference data yet.</p>
          <p className="text-xs text-gray-300">Swipe through an Autopilot plan to start training.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <ThumbsUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-700">{prefs!.totalLiked}</p>
              <p className="text-xs text-green-600">Liked</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <ThumbsDown className="h-4 w-4 text-red-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-600">{prefs!.totalDisliked}</p>
              <p className="text-xs text-red-500">Skipped</p>
            </div>
          </div>

          {/* Tone notes */}
          {prefs!.toneNotes && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-medium text-blue-700 mb-1">Style insights</p>
              <p className="text-xs text-blue-600 leading-relaxed">{prefs!.toneNotes}</p>
            </div>
          )}

          {/* Preferred post types */}
          {prefs!.preferredPostTypes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Preferred types</p>
              <div className="flex flex-wrap gap-1.5">
                {prefs!.preferredPostTypes.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs capitalize">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prefs!.avoidedPostTypes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Tends to skip</p>
              <div className="flex flex-wrap gap-1.5">
                {prefs!.avoidedPostTypes.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs capitalize">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            {resetDone ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" /> Preferences reset
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {prefs!.hasEnoughData ? 'Enough data to influence generation' : 'Need 10+ swipes to influence generation'}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Reset
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AutopilotSettingsPanel({ clientId, client, onUpdate }: AutopilotSettingsPanelProps) {
  const [openSection, setOpenSection] = useState<Section>('autopilot-control');
  const [localClient, setLocalClient] = useState<Client>(client);

  const handleSaved = useCallback((updated: Client) => {
    setLocalClient(updated);
    onUpdate?.(updated);
  }, [onUpdate]);

  const toggle = (section: Section) => {
    setOpenSection(prev => (prev === section ? ('none' as Section) : section));
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Bot className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Autopilot Settings</h2>
          <p className="text-xs text-gray-500">Configure automated content generation for {localClient.name}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Section D — Autopilot Control */}
        <div className="px-4">
          <SectionHeader
            title="Autopilot Control"
            open={openSection === 'autopilot-control'}
            onToggle={() => toggle('autopilot-control')}
          />
          {openSection === 'autopilot-control' && (
            <div className="pb-4">
              <AutopilotControlSection
                clientId={clientId}
                initialEnabled={localClient.autopilot_enabled}
                initialSettings={localClient.autopilot_settings}
                onSaved={handleSaved}
              />
            </div>
          )}
        </div>

        {/* Section A — Operating Hours */}
        <div className="px-4">
          <SectionHeader
            title="Operating Hours"
            open={openSection === 'operating-hours'}
            onToggle={() => toggle('operating-hours')}
          />
          {openSection === 'operating-hours' && (
            <div className="pb-4">
              <OperatingHoursSection
                clientId={clientId}
                initial={localClient.operating_hours}
                onSaved={handleSaved}
              />
            </div>
          )}
        </div>

        {/* Section B — Posting Preferences */}
        <div className="px-4">
          <SectionHeader
            title="Posting Preferences"
            open={openSection === 'posting-preferences'}
            onToggle={() => toggle('posting-preferences')}
          />
          {openSection === 'posting-preferences' && (
            <div className="pb-4">
              <PostingPreferencesSection
                clientId={clientId}
                initial={localClient.posting_preferences}
                onSaved={handleSaved}
              />
            </div>
          )}
        </div>

        {/* Section C — Business Context */}
        <div className="px-4">
          <SectionHeader
            title="Business Context"
            open={openSection === 'business-context'}
            onToggle={() => toggle('business-context')}
          />
          {openSection === 'business-context' && (
            <div className="pb-4">
              <BusinessContextSection
                clientId={clientId}
                initial={localClient.business_context}
                onSaved={handleSaved}
              />
            </div>
          )}
        </div>

        {/* Section E — Style Preferences */}
        <div className="px-4">
          <SectionHeader
            title="Style Preferences"
            open={openSection === 'style-preferences'}
            onToggle={() => toggle('style-preferences')}
          />
          {openSection === 'style-preferences' && (
            <PreferenceStatsSection clientId={clientId} />
          )}
        </div>
      </div>
    </div>
  );
}
