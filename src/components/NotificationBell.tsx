'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUIThemeStyles } from '@/hooks/useUITheme';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  client_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 45_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { user, getAccessToken } = useAuth();
  const { getThemeClasses } = useUIThemeStyles();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch('/api/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silent — this is a background poll, not worth surfacing an error UI for
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    setOpen(prev => !prev);
    if (!open) fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // local state already optimistically updated; a stale unread count
      // self-corrects on the next poll
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read_at) {
      const token = getAccessToken();
      setNotifications(prev =>
        prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (token) {
        fetch(`/api/notifications/${n.id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className={getThemeClasses(
          'relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors',
          'relative w-9 h-9 flex items-center justify-center rounded-full glass-button transition-colors'
        )}
        aria-label="Notifications"
      >
        <Bell className={getThemeClasses('w-4.5 h-4.5 text-gray-600', 'w-4.5 h-4.5 glass-text-primary')} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1"
              >
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No notifications yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    !n.read_at ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    <div className={n.read_at ? 'pl-3.5' : ''}>
                      <p className="text-sm font-medium text-gray-800">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
