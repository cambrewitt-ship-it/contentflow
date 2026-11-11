"use client";
import { User, Plus, Calendar, CalendarCheck, Clock, Activity, Users, Building2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSingleClientTier } from "../../lib/tierUtils";
import OnboardingChecklist from "../../components/OnboardingChecklist";
import { AttentionSummary, usePortfolio } from "../../components/analytics/Portfolio";
import {
  BrandCard,
  BrandHero,
  BrandPerformancePanel,
  CreateContentButton,
  MetricGrid,
  PortfolioPerformancePanel,
  QuickActions,
  WeekAheadPanel,
  type Metric,
} from "../../components/home/HomeDashboard";

const compactNumber = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

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
  const singleBrand = clients.length === 1 ? clients[0] : null;
  const pulses = portfolio.clients;
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const logos = Object.fromEntries(clients.map((c) => [c.id, c.logo_url]));

  // Totals of the existing per-brand overview counts
  const portfolioList = Object.values(pulses);
  const totalScheduled = portfolioList.reduce((n, p) => n + p.scheduledNext7, 0);
  const totalAwaiting = portfolioList.reduce((n, p) => n + p.awaitingApproval, 0);
  const totalAttention = portfolioList.reduce((n, p) => n + p.attention.length, 0);
  const totalCritical = portfolioList.reduce((n, p) => n + p.attention.filter((a) => a.level === 'critical').length, 0);
  const totalUnread = Object.values(unreadCounts).reduce((n, c) => n + (c || 0), 0);
  const metricsLoading = clients.length > 0 && !portfolio.loaded;

  const singlePulse = singleBrand ? pulses[singleBrand.id] : undefined;
  const metrics: Metric[] = singleBrand
    ? [
        {
          label: 'Scheduled',
          value: singlePulse?.scheduledNext7 ?? '—',
          hint: 'Next 7 days',
          icon: CalendarCheck,
          href: `/dashboard/client/${singleBrand.id}/calendar`,
          tone: 'blue',
        },
        {
          label: 'Awaiting approval',
          value: singlePulse?.awaitingApproval ?? '—',
          hint: 'Posts in the next 7 days',
          icon: Clock,
          href: `/dashboard/client/${singleBrand.id}/calendar`,
          tone: singlePulse && singlePulse.awaitingApproval > 0 ? 'amber' : 'cyan',
        },
        {
          label: 'Engagement',
          value:
            singlePulse?.last30 && singlePulse.last30.posts
              ? `${singlePulse.last30.medianEngagementRate.toFixed(1)}%`
              : '—',
          hint: singlePulse?.last30 ? `Median · ${singlePulse.last30.posts} posts in 30 days` : 'Last 30 days',
          icon: Activity,
          href: `/dashboard/client/${singleBrand.id}/analytics`,
          tone: 'violet',
        },
        {
          label: 'Followers',
          value: singlePulse?.followers ? compactNumber.format(singlePulse.followers.current) : '—',
          hint:
            singlePulse?.followers && singlePulse.followers.gained30d !== 0
              ? `${singlePulse.followers.gained30d > 0 ? '+' : ''}${compactNumber.format(singlePulse.followers.gained30d)} in 30 days`
              : 'Across connected accounts',
          icon: Users,
          href: `/dashboard/client/${singleBrand.id}/analytics`,
          tone: 'emerald',
        },
      ]
    : [
        { label: 'Brands', value: clients.length, hint: 'Managed in this workspace', icon: Building2, tone: 'blue' },
        { label: 'Scheduled', value: totalScheduled, hint: 'Posts in the next 7 days', icon: CalendarCheck, tone: 'cyan' },
        {
          label: 'Awaiting approval',
          value: totalAwaiting,
          hint: 'Posts in the next 7 days',
          icon: Clock,
          tone: totalAwaiting > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Needs attention',
          value: totalAttention,
          hint: totalCritical > 0 ? `${totalCritical} urgent` : totalUnread > 0 ? `${totalUnread} unread notifications` : 'Across all brands',
          icon: AlertTriangle,
          tone: totalCritical > 0 ? 'red' : totalAttention > 0 ? 'amber' : 'emerald',
        },
      ];

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Welcome ─────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">
              Welcome back, {firstName}!
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
              {/* Time and Date - only show after at least one business profile exists */}
              {clients.length > 0 && currentDate && (
                <>
                  <span className="text-gray-700">{currentDate}</span>
                  <span className="font-medium tabular-nums text-gray-700">{currentTime}</span>
                  <span className="text-gray-300">·</span>
                </>
              )}
              <span>
                {clients.length === 0
                  ? "Let's set up your first brand."
                  : singleBrand
                    ? `Here's what's happening with ${singleBrand.name}.`
                    : `Here's what's happening across your ${clients.length} brands.`}
              </span>
              {subscription && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getPlanBadgeColor()}`}>
                  {getPlanLabel()}
                </span>
              )}
            </p>
          </div>
          {clients.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-2">
              {singleBrand ? (
                <Button asChild variant="outline" size="lg" className="h-10 rounded-xl">
                  <Link href={`/dashboard/client/${singleBrand.id}/calendar`}>
                    <Calendar />
                    Calendar
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="lg" className="h-10 rounded-xl">
                  <Link href="/dashboard/clients/new">
                    <Plus />
                    Add brand
                  </Link>
                </Button>
              )}
              <CreateContentButton brands={clients} />
            </div>
          )}
        </header>

        {/* Onboarding Checklist */}
        <div className="max-w-3xl empty:hidden [&>div]:mb-0">
          <OnboardingChecklist />
        </div>

        {clients.length === 0 ? (
          /* ── No brands yet ───────────────────────────────────────────── */
          <div className="mx-auto max-w-lg rounded-2xl border border-gray-200/80 bg-white/90 p-10 text-center shadow-card backdrop-blur-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100/70 text-blue-700 ring-1 ring-blue-200/60">
              <User className="h-7 w-7" />
            </div>
            <h3 className="text-[17px] font-semibold text-gray-900 mb-1">
              No business profiles yet
            </h3>
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
            {/* ── Overview metrics ─────────────────────────────────────── */}
            <MetricGrid metrics={metrics} loading={metricsLoading} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ── Main column ──────────────────────────────────────────── */}
              <div className="min-w-0 space-y-6 lg:col-span-2">
                {singleBrand && (
                  <BrandHero brand={singleBrand} pulse={singlePulse} unread={unreadCounts[singleBrand.id] || 0} />
                )}

                <AttentionSummary
                  clients={pulses}
                  names={names}
                  logos={logos}
                  showBrand={!singleBrand}
                  loaded={portfolio.loaded}
                />

                {singleBrand ? (
                  <BrandPerformancePanel brand={singleBrand} pulse={singlePulse} loaded={portfolio.loaded} />
                ) : (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[17px] font-semibold tracking-[-0.012em] text-gray-900">
                        Your Business Profiles
                      </h2>
                      <span className="text-xs text-gray-500">{clients.length} brands</span>
                    </div>
                    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
                      {clients.map((client) => (
                        <BrandCard
                          key={client.id}
                          brand={client}
                          pulse={pulses[client.id]}
                          unread={unreadCounts[client.id] || 0}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* ── Side column ──────────────────────────────────────────── */}
              <aside className="min-w-0 space-y-6">
                <WeekAheadPanel brands={clients} portfolio={pulses} loaded={portfolio.loaded} />
                {singleBrand ? (
                  <QuickActions brandId={singleBrand.id} />
                ) : (
                  <PortfolioPerformancePanel brands={clients} portfolio={pulses} loaded={portfolio.loaded} />
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
