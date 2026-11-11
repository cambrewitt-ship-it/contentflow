"use client";
import { User, Plus, CalendarCheck, CalendarDays, Clock, Users, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isSingleClientTier } from "../../lib/tierUtils";
import OnboardingChecklist from "../../components/OnboardingChecklist";
import { usePortfolio } from "../../components/analytics/Portfolio";
import {
  attentionItems,
  AttentionBanner,
  ClientCard,
  ContentSuitePromo,
  CreateContentAction,
  formatCompact,
  KpiColumn,
  SectionCard,
  StatCard,
  Timeline,
  WelcomeHeader,
  type TimelineItem,
} from "../../components/home/DashboardOverview";
import ClientDashboard from "./client/[clientId]/page";


interface Client {
  id: string;
  name: string;
  description?: string;
  company_description?: string;
  website_url?: string;
  brand_tone?: string;
  logo_url?: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

type SubscriptionTier = 'freemium' | 'trial' | 'starter' | 'professional' | 'agency' | 'enterprise';

const SUBSCRIPTION_TIER_DISPLAY: Record<SubscriptionTier, string> = {
  freemium: 'Free',
  trial: 'Trial',
  starter: 'In-House',
  professional: 'Freelancer',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

interface Subscription {
  id: string;
  user_id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
}

export default function Dashboard() {
  const { user, signOut, getAccessToken } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  // How every client is doing, and what needs attention (analytics snapshots + calendar)
  const portfolio = usePortfolio(clients.length > 0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  // Default to Pacific/Auckland internally, but we'll only show the time
  // once the first business profile has been created and we know its timezone.
  const [displayTimezone, setDisplayTimezone] = useState<string>('Pacific/Auckland');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Track if we're redirecting single-client tier users to their client dashboard
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasCheckedRedirect = useRef(false);

  // Check for password reset hash fragments and redirect if needed
  // This handles cases where Supabase redirects to the dashboard instead of reset-password
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        // We have a password reset token in the hash, redirect to reset-password page
        // The hash will be preserved by the browser
        router.push('/auth/reset-password');
      }
    }
  }, [router]);

  // Fetch user profile - ONLY on mount or when user ID changes
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        // Set profile to null if not found (instead of throwing error)
        setProfile(data || null);
      } catch (err) {
        console.error('Error fetching profile:', err);
        // Don't set error state for profile fetch failure
      }
    }

    fetchProfile();
  }, [user?.id]); // ✅ Only depend on user ID, not entire user object

  // Fetch user subscription
  useEffect(() => {
    async function fetchSubscription() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id, user_id, subscription_tier, subscription_status')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription:', error);
          // Set to trial if not found
          setSubscription({ id: '', user_id: user.id, subscription_tier: 'trial', subscription_status: 'active' });
        } else if (data) {
          setSubscription(data);
        } else {
          // No subscription found, default to trial
          setSubscription({ id: '', user_id: user.id, subscription_tier: 'trial', subscription_status: 'active' });
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
        // Default to trial on error
        setSubscription({ id: '', user_id: user.id, subscription_tier: 'trial', subscription_status: 'active' });
      }
    }

    fetchSubscription();
  }, [user?.id]);

  // Fetch user's clients - ONLY on mount or when user ID changes
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching user clients for dashboard...');
        
        const token = getAccessToken();
        if (!token) {
          console.log('No access token available, skipping client fetch');
          return;
        }
        
        const response = await fetch('/api/clients', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please log in to view your business profiles');
          }
          throw new Error(`Failed to fetch clients: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ User clients fetched successfully:', data.clients);

        // Ensure clients are ordered from oldest to newest by creation date
        const orderedClients: Client[] = (data.clients || []).slice().sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          return aTime - bTime;
        });

        setClients(orderedClients);
        
        // Set timezone from the oldest client (first created business profile)
        if (orderedClients.length > 0 && orderedClients[0].timezone) {
          setDisplayTimezone(orderedClients[0].timezone);
        }
      } catch (err) {
        console.error('❌ Error fetching clients:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch clients');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchClients();
    }
  }, [user?.id, getAccessToken]); // ✅ Only depend on user ID, not entire user object

  // Fetch unread notification counts for all clients
  useEffect(() => {
    async function fetchUnreadCounts() {
      if (!user) return;
      
      const token = getAccessToken();
      if (!token) return;
      
      try {
        console.log('📊 Fetching unread notification counts...');
        
        const response = await fetch('/api/clients/unread-counts', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Unread counts fetched:', data.unreadCounts);
          setUnreadCounts(data.unreadCounts || {});
        } else {
          console.error('❌ Failed to fetch unread counts:', response.statusText);
        }
      } catch (err) {
        console.error('❌ Error fetching unread counts:', err);
      }
    }

    // Fetch unread counts after clients are loaded
    if (clients.length > 0) {
      fetchUnreadCounts();
    }
  }, [clients, user, getAccessToken]);

  // Update time and date every minute - using first client's timezone
  useEffect(() => {
    // Don't attempt to format time/date until at least one business profile exists
    if (clients.length === 0) return;

    const updateTimeAndDate = () => {
      const now = new Date();
      
      // Format time in client's timezone
      const formattedTime = now.toLocaleString('en-US', {
        timeZone: displayTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(formattedTime);
      
      // Format date in client's timezone
      const formattedDateStr = now.toLocaleDateString('en-US', {
        timeZone: displayTimezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      
      // Get the day number in the timezone
      const dayInTimezone = parseInt(now.toLocaleDateString('en-US', {
        timeZone: displayTimezone,
        day: 'numeric'
      }));
      
      // Add ordinal suffix to day (1st, 2nd, 3rd, 4th, etc.)
      const ordinal = dayInTimezone === 1 || dayInTimezone === 21 || dayInTimezone === 31 ? 'st' :
                     dayInTimezone === 2 || dayInTimezone === 22 ? 'nd' :
                     dayInTimezone === 3 || dayInTimezone === 23 ? 'rd' : 'th';
      
      const formattedDate = formattedDateStr.replace(/\d+/, `${dayInTimezone}${ordinal}`);
      setCurrentDate(formattedDate);
    };

    // Update immediately
    updateTimeAndDate();
    
    // Update every minute (60000ms)
    const interval = setInterval(updateTimeAndDate, 60000);
    
    return () => clearInterval(interval);
  }, [displayTimezone, clients.length]);

  // =============================================
  // TIER-BASED REDIRECT LOGIC
  // =============================================
  // Single-client tiers (Free, In-House) should skip this home dashboard
  // and be redirected directly to their client dashboard.
  // Multi-client tiers (Freelancer, Agency) see this home dashboard.
  useEffect(() => {
    // Only run redirect logic once when data is loaded
    if (loading || hasCheckedRedirect.current) return;
    
    // Need subscription data to determine tier
    if (!subscription) return;
    
    const tier = subscription.subscription_tier;
    const shouldRedirect = isSingleClientTier(tier);
    
    console.log('🔀 Tier-based navigation check:', {
      tier,
      isSingleClient: shouldRedirect,
      clientsCount: clients.length,
      hasCheckedRedirect: hasCheckedRedirect.current
    });
    
    // Mark as checked to prevent re-running
    hasCheckedRedirect.current = true;
    
    if (shouldRedirect) {
      if (clients.length === 1) {
        // Single-client tier with exactly 1 client: redirect to client dashboard
        const clientId = clients[0].id;
        console.log(`🔀 Redirecting single-client tier user (${tier}) to client dashboard:`, clientId);
        setIsRedirecting(true);
        router.replace(`/dashboard/client/${clientId}`);
      } else if (clients.length === 0) {
        // Single-client tier with 0 clients: stay on dashboard to show onboarding
        // The "no clients" UI will prompt them to create their first client
        console.log(`📝 Single-client tier user (${tier}) has no clients - showing onboarding`);
      } else {
        // Edge case: single-client tier with multiple clients (shouldn't happen)
        // Log warning but don't break - just show the dashboard
        console.warn(`⚠️ Single-client tier user (${tier}) has multiple clients (${clients.length}). This shouldn't happen.`);
      }
    } else {
      // Multi-client tier: show the home dashboard
      console.log(`🏠 Multi-client tier user (${tier}) - showing home dashboard`);
    }
  }, [loading, subscription, clients, router]);

  // Upcoming activity for the agency overview: each brand's next scheduled post,
  // from the same read-only activity feed the brand dashboard shows.
  const [upcoming, setUpcoming] = useState<Array<{ clientId: string; date: string; time: string | null; caption: string; status: string }>>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  useEffect(() => {
    if (clients.length < 2) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    setUpcomingLoading(true);
    Promise.all(
      clients.slice(0, 12).map(async (c) => {
        try {
          const res = await fetch(`/api/clients/${c.id}/activity-logs`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (!res.ok) return null;
          const data = await res.json();
          const next = (data.activities || []).find(
            (a: { type?: string; details?: { scheduledDate?: string } | null }) => a.type === 'next_scheduled' && a.details?.scheduledDate
          );
          if (!next) return null;
          return {
            clientId: c.id,
            date: next.details.scheduledDate as string,
            time: (next.details.scheduledTime as string | null) ?? null,
            caption: (next.details.caption as string) || '',
            status: (next.status as string) || '',
          };
        } catch {
          return null;
        }
      })
    )
      .then((rows) => {
        if (cancelled) return;
        setUpcoming(rows.filter((r): r is NonNullable<typeof r> => !!r));
      })
      .finally(() => {
        if (!cancelled) setUpcomingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clients, getAccessToken]);

  // Show loading state while fetching data or while redirecting
  if (loading || isRedirecting) {
    return (
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl" aria-busy="true">
          <p className="sr-only">
            {isRedirecting ? 'Redirecting to your dashboard...' : 'Loading your business profiles...'}
          </p>
          <div className="h-7 w-64 animate-pulse rounded-lg bg-gray-200/60" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded-md bg-gray-200/50" />
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-gray-200/60 bg-white/70" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="h-64 animate-pulse rounded-2xl border border-gray-200/60 bg-white/70 lg:col-span-2" />
            <div className="h-64 animate-pulse rounded-2xl border border-gray-200/60 bg-white/70" />
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isRedirecting ? 'Redirecting to your dashboard...' : 'Loading your business profiles...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
            <User className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-[17px] font-semibold text-gray-900 mb-2">Error Loading Business Profiles</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }


  // Get plan label
  const getPlanLabel = () => {
    if (!subscription) return 'TRIAL';
    const tier = subscription.subscription_tier || 'trial';
    if (tier === 'freemium') return 'FREE';
    if (tier === 'trial') return 'TRIAL';
    return SUBSCRIPTION_TIER_DISPLAY[tier] ?? tier.toUpperCase();
  };

  // Get plan badge color
  const getPlanBadgeColor = () => {
    const tier = subscription?.subscription_tier || 'trial';
    switch (tier) {
      case 'freemium':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'trial':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'starter':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'professional':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'agency':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'enterprise':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const firstName = (() => {
    const fullName = profile?.full_name || '';
    return fullName.split(' ')[0] || profile?.username || user?.email?.split('@')[0] || 'User';
  })();

  // One brand: the home is that brand's own dashboard (with its Activity Hub and calendar)
  if (clients.length === 1) {
    return <SingleBrandHome clientId={clients[0].id} />;
  }

  const pulses = portfolio.clients;
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const portfolioList = clients.map((c) => pulses[c.id]).filter(Boolean);
  const metricsLoading = clients.length > 0 && !portfolio.loaded;
  const sum = (f: (p: (typeof portfolioList)[number]) => number) => portfolioList.reduce((n, p) => n + f(p!), 0);
  const totalScheduled = sum((p) => p.scheduledNext7);
  const totalAwaiting = sum((p) => p.awaitingApproval);
  const totalFollowers = sum((p) => p.followers?.current ?? 0);
  const totalGained = sum((p) => p.followers?.gained30d ?? 0);
  const totalPosts30 = sum((p) => p.last30?.posts ?? 0);
  const items = attentionItems(clients.map((c) => pulses[c.id]));
  const critical = items.filter((i) => i.level === 'critical').length;
  const perBrand = (f: (p: (typeof portfolioList)[number]) => number) =>
    clients.filter((c) => pulses[c.id]).map((c) => ({ label: c.name, value: f(pulses[c.id]) }));
  const engagementRows = clients
    .map((c) => ({ c, r: pulses[c.id]?.last30 }))
    .filter((x) => x.r && x.r.posts > 0)
    .sort((a, b) => b.r!.medianEngagementRate - a.r!.medianEngagementRate);
  const engagementMax = Math.max(...engagementRows.map((x) => x.r!.medianEngagementRate), 0);

  const timeline: TimelineItem[] = upcoming
    .map((u) => {
      const when = new Date(`${u.date}T${u.time ? u.time.slice(0, 5) : '00:00'}`);
      const p = pulses[u.clientId];
      return {
        id: u.clientId,
        when,
        dateOnly: !u.time,
        title: `Scheduled post – ${names[u.clientId] ?? 'Client'}`,
        subtitle: u.caption && u.caption !== 'No caption' ? u.caption : undefined,
        href: `/dashboard/client/${u.clientId}/calendar`,
        badge:
          p && p.awaitingApproval > 0 ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">Approval</span>
          ) : undefined,
      };
    })
    .filter((t) => !Number.isNaN(t.when.getTime()))
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Welcome ─────────────────────────────────────────────────── */}
        <WelcomeHeader
          logo={<img src="/cm-logo.png" alt="Content Manager" className="w-14 mix-blend-multiply md:w-16" />}
          title={<>Welcome back, {firstName}!</>}
          subtitle={clients.length === 0 ? "Let's set up your first business profile." : "Here's what's happening with your clients."}
          meta={
            clients.length > 0 && currentDate ? (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <span>{currentDate}</span>
                <span className="tabular-nums">{currentTime}</span>
                {subscription && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getPlanBadgeColor()}`}>
                    {getPlanLabel()}
                  </span>
                )}
              </span>
            ) : undefined
          }
          actions={clients.length > 0 ? <CreateContentAction brands={clients} /> : undefined}
        />

        {/* Onboarding Checklist */}
        <div className="max-w-3xl empty:hidden [&>div]:mb-0">
          <OnboardingChecklist />
        </div>

        {clients.length === 0 ? (
          /* ── No brands yet ───────────────────────────────────────────── */
          <div className="mx-auto max-w-lg rounded-3xl border border-white/80 bg-white/90 p-10 text-center shadow-card backdrop-blur-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100/70 text-blue-700 ring-1 ring-blue-200/60">
              <User className="h-7 w-7" />
            </div>
            <h3 className="text-[17px] font-semibold text-gray-900 mb-1">No business profiles yet</h3>
            <p className="mb-6 text-sm text-gray-500">Add your brand to start creating and scheduling content.</p>
            <Link href="/dashboard/clients/new">
              <Button size="lg" className="h-10 rounded-xl px-6">
                <Plus className="w-5 h-5" />
                Create New Business Profile
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Needs attention ─────────────────────────────────────── */}
            <AttentionBanner items={items} names={names} showBrand />

            {/* ── Metrics ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={CalendarCheck}
                value={totalScheduled}
                label="Scheduled Posts"
                note="Next 7 days"
                tone="blue"
                bars={perBrand((p) => p.scheduledNext7)}
                loading={metricsLoading}
              />
              <StatCard
                icon={Clock}
                value={totalAwaiting}
                label="Awaiting Approval"
                note={totalAwaiting > 0 ? 'Posts in the next 7 days' : 'Nothing waiting'}
                tone="violet"
                bars={perBrand((p) => p.awaitingApproval)}
                loading={metricsLoading}
              />
              <StatCard
                icon={Users}
                value={totalFollowers ? formatCompact(totalFollowers) : '—'}
                label="Followers"
                change={totalGained ? { value: `${totalGained > 0 ? '+' : ''}${formatCompact(totalGained)} (30d)`, up: totalGained > 0 } : null}
                note="Across connected accounts"
                tone="emerald"
                bars={perBrand((p) => p.followers?.current ?? 0)}
                loading={metricsLoading}
              />
              <StatCard
                icon={AlertTriangle}
                value={items.length}
                label="Needs Attention"
                note={critical > 0 ? `${critical} urgent` : items.length ? 'To review' : 'All clear'}
                tone={critical > 0 ? 'red' : items.length ? 'amber' : 'emerald'}
                bars={perBrand((p) => p.attention.length)}
                loading={metricsLoading}
              />
            </div>

            {/* ── Clients + upcoming ──────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[22px] font-bold tracking-[-0.02em] text-gray-900">Your Clients</h2>
                  <Link
                    href="/dashboard/clients/new"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-800 shadow-xs transition-colors hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add client
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {clients.map((client) => (
                    <ClientCard key={client.id} brand={client} pulse={pulses[client.id]} unread={unreadCounts[client.id] || 0} />
                  ))}
                </div>
              </section>

              <SectionCard title="Upcoming Activity" icon={CalendarDays}>
                <Timeline items={timeline} loading={upcomingLoading && !upcoming.length} empty="No upcoming posts scheduled." />
              </SectionCard>
            </div>

            {/* ── Performance + Content Suite ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <SectionCard
                title="Performance Overview"
                action={<span className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700">Last 30 days</span>}
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
                  <div>
                    <p className="mb-3 text-xs font-medium text-gray-500">Median engagement rate by client</p>
                    {!portfolio.loaded ? (
                      <div className="space-y-3">
                        {[0, 1, 2].map((i) => <div key={i} className="h-6 animate-pulse rounded-lg bg-gray-50" />)}
                      </div>
                    ) : engagementRows.length === 0 ? (
                      <p className="rounded-2xl bg-gray-50/80 px-4 py-6 text-center text-[13px] text-gray-500">
                        Results appear once clients have connected accounts and published posts.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {engagementRows.slice(0, 6).map(({ c, r }) => (
                          <li key={c.id}>
                            <Link href={`/dashboard/client/${c.id}/analytics`} className="group block">
                              <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                                <span className="truncate text-gray-700 group-hover:text-gray-900">{c.name}</span>
                                <span className="font-semibold tabular-nums text-gray-900">{r!.medianEngagementRate.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-700"
                                  style={{ width: `${engagementMax ? Math.max(4, (r!.medianEngagementRate / engagementMax) * 100) : 0}%` }}
                                />
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-100">
                    <KpiColumn
                      value={totalGained ? `${totalGained > 0 ? '+' : ''}${formatCompact(totalGained)}` : '—'}
                      label="Followers gained"
                      positive={totalGained ? totalGained > 0 : null}
                    />
                    <KpiColumn value={portfolio.loaded ? String(totalPosts30) : '—'} label="Posts published" />
                    <KpiColumn value={portfolio.loaded ? String(totalScheduled) : '—'} label="Scheduled next 7 days" />
                  </div>
                </div>
              </SectionCard>
              <ContentSuitePromo brands={clients} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One-brand accounts: Home shows that brand's dashboard (overview, Activity Hub and calendar). */
function SingleBrandHome({ clientId }: { clientId: string }) {
  const params = useMemo(() => Promise.resolve({ clientId }), [clientId]);
  return <ClientDashboard params={params} />;
}
