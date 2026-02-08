"use client";
import { User, Plus, Settings, LogOut, PenTool, Calendar, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSingleClientTier } from "../../lib/tierUtils";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [displayTimezone, setDisplayTimezone] = useState<string>('Pacific/Auckland');
  
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
        
        setClients(data.clients || []);
        
        // Set timezone from first client (or keep default)
        if (data.clients && data.clients.length > 0 && data.clients[0].timezone) {
          setDisplayTimezone(data.clients[0].timezone);
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

  // Update time and date every minute - using first client's timezone
  useEffect(() => {
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
  }, [displayTimezone]);

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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isRedirecting 
              ? 'Redirecting to your dashboard...' 
              : 'Loading your business profiles...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Error Loading Business Profiles</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
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

  return (
    <div className="flex-1 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 mt-[50px]">
          <div className="max-w-xl mx-auto">
            {/* Time and Date */}
            <div className="mb-4 text-center">
              <p className="text-4xl font-bold font-mono text-foreground">
                {currentTime}
              </p>
              <p className="text-lg text-muted-foreground mt-2">
                {currentDate}
              </p>
            </div>

            {/* Welcome back text in the middle */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {(() => {
                  const fullName = profile?.full_name || '';
                  const firstName = fullName.split(' ')[0] || profile?.username || user?.email?.split('@')[0] || 'User';
                  return firstName;
                })()}!
              </h1>
            </div>
          </div>
        </div>


        {/* Clients Section */}
        <div className="mb-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Your Business Profiles
            </h2>
          </div>

          {clients.length === 0 ? (
            <div className="p-12 text-center">
              <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No business profiles yet
              </h3>
              <Link href="/dashboard/clients/new">
                <Button size="lg" className="px-8">
                  <Plus className="w-5 h-5 mr-2" />
                  Create New Business Profile
                </Button>
              </Link>
            </div>
          ) : (
            <div className={
              clients.length === 1 
                ? "flex justify-center" 
                : "grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
            }>
              {clients.map((client) => (
                <Card 
                  key={client.id} 
                  className={`transition-all hover:shadow-lg flex flex-col h-full opacity-90 ${
                    clients.length === 1 ? "w-full max-w-2xl" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                          client.logo_url 
                            ? '' 
                            : 'bg-blue-100 text-blue-700'
                        } overflow-hidden`}>
                          {client.logo_url ? (
                            <img 
                              src={client.logo_url} 
                              alt={`${client.name} logo`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{client.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl font-bold break-words leading-tight">
                            {client.name}
                          </CardTitle>
                        </div>
                      </div>
                      <Link href={`/dashboard/client/${client.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-white/80 backdrop-blur-sm border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                        >
                          View Dashboard
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    {client.company_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {client.company_description}
                      </p>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 mb-4">
                      <Link 
                        href={`/dashboard/client/${client.id}/content-suite`}
                        className="flex-1"
                      >
                        <Button 
                          className="w-full bg-gradient-to-r from-pink-300 via-purple-500 to-purple-700 hover:from-pink-400 hover:via-purple-600 hover:to-purple-800 text-white font-bold shadow-md hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                          style={{ borderRadius: '8px', height: '40px' }}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm">Create Content</span>
                        </Button>
                      </Link>
                      <Link 
                        href={`/dashboard/client/${client.id}/calendar`}
                        className="flex-1"
                      >
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white font-bold shadow-md hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                          style={{ borderRadius: '8px', height: '40px' }}
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">Calendar</span>
                        </Button>
                      </Link>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-auto">
                      <span>Created {new Date(client.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
} 