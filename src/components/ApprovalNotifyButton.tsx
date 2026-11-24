'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Loader2, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authedFetchJson } from '@/lib/authedFetch';

// Calendar action-bar button + dialog for "Notify by email": who gets an email when a
// post is approved, gets a comment, is moved, etc. API: /api/clients/[clientId]/approval-watchers

interface Watcher {
  id: string;
  email: string;
  name: string | null;
  member_id: string | null;
}

interface Suggestion {
  email: string;
  name: string;
  label: string;
  member_id: string | null;
}

interface WatchersResponse {
  watchers: Watcher[];
  suggestions: Suggestion[];
  emailConfigured: boolean;
  setupRequired?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ApprovalNotifyButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WatchersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetchJson<WatchersResponse>(`/api/clients/${clientId}/approval-watchers`);
      setData({
        watchers: res.watchers ?? [],
        suggestions: res.suggestions ?? [],
        emailConfigured: res.emailConfigured !== false,
        setupRequired: res.setupRequired,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Load once up front so the button can show how many people are notified
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const watching = useMemo(() => new Set((data?.watchers ?? []).map(w => w.email.toLowerCase())), [data]);

  const typed = email.trim().toLowerCase();
  const filteredSuggestions = (data?.suggestions ?? []).filter(
    s => !watching.has(s.email) && (!typed || s.email.includes(typed) || s.name.toLowerCase().includes(typed))
  );

  const add = async (address: string, name?: string) => {
    const value = address.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(value);
    setError(null);
    try {
      const res = await authedFetchJson<{ watcher: Watcher }>(`/api/clients/${clientId}/approval-watchers`, {
        method: 'POST',
        body: { email: value, name: name ?? null },
      });
      setData(prev =>
        prev && !prev.watchers.some(w => w.id === res.watcher.id)
          ? { ...prev, watchers: [...prev.watchers, res.watcher] }
          : prev
      );
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that email');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (watcher: Watcher) => {
    setBusy(watcher.id);
    setError(null);
    try {
      await authedFetchJson(`/api/clients/${clientId}/approval-watchers?id=${watcher.id}`, { method: 'DELETE' });
      setData(prev => (prev ? { ...prev, watchers: prev.watchers.filter(w => w.id !== watcher.id) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that email');
    } finally {
      setBusy(null);
    }
  };

  const count = data?.watchers.length ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-all border ${
          count > 0
            ? 'border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-50 hover:border-sky-300'
            : 'border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-50 hover:border-gray-300'
        }`}
        title="Get an email whenever a post is approved, commented on, moved or sent back"
      >
        {count > 0 ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4 text-gray-500" />}
        Notify by email{count > 0 ? ` (${count})` : ''}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-blue-600" />
              Approval update emails
            </DialogTitle>
            <DialogDescription>
              These people get an email as soon as a post is approved, gets a comment, is moved to a new date,
              or gets an &ldquo;Improve&rdquo; or reject — from the Content Portal or an approval link.
            </DialogDescription>
          </DialogHeader>

          {data?.setupRequired && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {data.setupRequired}
            </div>
          )}
          {data && !data.emailConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Email sending isn&rsquo;t configured on this server (RESEND_API_KEY), so no emails will go out.
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              void add(email);
            }}
          >
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Type an email or search people below"
              aria-label="Email address to notify"
              disabled={!!data?.setupRequired}
            />
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!typed || !!busy || !!data?.setupRequired}>
              {busy === typed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {filteredSuggestions.length > 0 && !data?.setupRequired && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                People who use the portal
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filteredSuggestions.map(s => (
                  <button
                    key={s.email}
                    type="button"
                    onClick={() => void add(s.email, s.name)}
                    disabled={!!busy}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-blue-50/60 disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="truncate text-xs text-gray-500">{s.email}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{s.label}</span>
                    {busy === s.email ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <Plus className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Getting emails</p>
            {loading && !data ? (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : count === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">
                No one yet — add an email above.
              </p>
            ) : (
              <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {data!.watchers.map(w => (
                  <li key={w.id} className="flex items-center gap-3 px-3 py-2">
                    <Mail className="w-4 h-4 shrink-0 text-sky-600" />
                    <div className="min-w-0 flex-1">
                      {w.name && <div className="truncate text-sm font-medium text-gray-900">{w.name}</div>}
                      <div className={`truncate ${w.name ? 'text-xs text-gray-500' : 'text-sm text-gray-900'}`}>{w.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(w)}
                      disabled={!!busy}
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-60"
                      aria-label={`Stop emailing ${w.email}`}
                      title="Stop emailing"
                    >
                      {busy === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-gray-500">
            People aren&rsquo;t emailed about changes they make themselves. Every email has a link to stop them.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
