'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface ChecklistState {
  checklist_business_profile: boolean;
  checklist_create_post: boolean;
  checklist_add_to_calendar: boolean;
  checklist_connect_social: boolean;
  checklist_publish_post: boolean;
}

interface OnboardingChecklistProps {
  /** Pass the current clientId when rendering inside a client dashboard */
  clientId?: string;
  /** Called after a successful fetch so parent can react if needed */
  onLoad?: (checklist: ChecklistState) => void;
}

export default function OnboardingChecklist({ clientId, onLoad }: OnboardingChecklistProps) {
  const { getAccessToken } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fetchChecklist = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch('/api/onboarding/checklist', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.checklist) {
        setChecklist(data.checklist);
        onLoad?.(data.checklist);
      }
    } catch {
      // silently ignore — checklist is non-critical
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, onLoad]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  if (loading || !checklist) return null;

  const allComplete =
    checklist.checklist_business_profile &&
    checklist.checklist_create_post &&
    checklist.checklist_add_to_calendar &&
    checklist.checklist_connect_social &&
    checklist.checklist_publish_post;

  if (allComplete) return null;

  const contentSuiteHref = clientId
    ? `/dashboard/client/${clientId}/content-suite`
    : '/dashboard';
  const calendarHref = clientId
    ? `/dashboard/client/${clientId}/calendar`
    : '/dashboard';

  const items = [
    {
      key: 'checklist_business_profile' as const,
      label: 'Create a Business Profile',
      description: 'Set up your first business profile to get started.',
      href: '/dashboard/clients/new',
      done: checklist.checklist_business_profile,
    },
    {
      key: 'checklist_create_post' as const,
      label: 'Create a Post',
      description: 'Upload a photo and select a caption in the Content Suite.',
      href: contentSuiteHref,
      done: checklist.checklist_create_post,
    },
    {
      key: 'checklist_add_to_calendar' as const,
      label: 'Add a Post to Calendar',
      description: 'Schedule a post on a specific date in the Calendar.',
      href: calendarHref,
      done: checklist.checklist_add_to_calendar,
    },
    {
      key: 'checklist_connect_social' as const,
      label: 'Connect your Social Media',
      description: 'Link at least one social media account from your client dashboard.',
      href: clientId
        ? `/dashboard/client/${clientId}#social-media-platforms`
        : '/dashboard',
      done: checklist.checklist_connect_social,
    },
    {
      key: 'checklist_publish_post' as const,
      label: 'Publish a Post',
      description: 'Send a scheduled post to your social media accounts.',
      href: calendarHref,
      done: checklist.checklist_publish_post,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const progressPct = Math.round((completedCount / items.length) * 100);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm">Getting Started</span>
            <span className="text-xs text-muted-foreground">
              {completedCount} of {items.length} steps complete
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pill */}
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {progressPct}%
          </span>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-1 bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Items */}
      {!collapsed && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-5 py-3.5">
              {item.done ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {item.done ? (
                  <p className="text-sm font-medium text-muted-foreground line-through">
                    {item.label}
                  </p>
                ) : (
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
                {!item.done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.href}
                  className="text-xs font-medium text-primary hover:underline shrink-0 mt-0.5"
                >
                  Start →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
