"use client";
import { User, Plus, Settings, LogOut, PenTool, Calendar, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  description?: string;
  company_description?: string;
  website_url?: string;
  brand_tone?: string;
  logo_url?: string;
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

type SubscriptionTier = 'freemium' | 'starter' | 'professional' | 'agency' | 'enterprise';

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
          // Set to freemium if not found
          setSubscription({ id: '', user_id: user.id, subscription_tier: 'freemium', subscription_status: 'active' });
        } else if (data) {
          setSubscription(data);
        } else {
          // No subscription found, default to freemium
          setSubscription({ id: '', user_id: user.id, subscription_tier: 'freemium', subscription_status: 'active' });
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
        // Default to freemium on error
        setSubscription({ id: '', user_id: user.id, subscription_tier: 'freemium', subscription_status: 'active' });
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
            throw new Error('Please log in to view your clients');
          }
          throw new Error(`Failed to fetch clients: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ User clients fetched successfully:', data.clients);
        
        setClients(data.clients || []);
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

  // Update NZST time and date every minute
  useEffect(() => {
    const updateTimeAndDate = () => {
      const now = new Date();
      
      // Format time
      const nzstTime = now.toLocaleString('en-US', {
        timeZone: 'Pacific/Auckland',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(nzstTime);
      
      // Format date
      const nzstDate = now.toLocaleDateString('en-US', {
        timeZone: 'Pacific/Auckland',
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      
      // Add ordinal suffix to day (1st, 2nd, 3rd, 4th, etc.)
      const day = now.getDate();
      const ordinal = day === 1 || day === 21 || day === 31 ? 'st' :
                     day === 2 || day === 22 ? 'nd' :
                     day === 3 || day === 23 ? 'rd' : 'th';
      
      const formattedDate = nzstDate.replace(/\d+/, `${day}${ordinal}`);
      setCurrentDate(formattedDate);
    };

    // Update immediately
    updateTimeAndDate();
    
    // Update every minute (60000ms)
    const interval = setInterval(updateTimeAndDate, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your clients...</p>
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
          <h1 className="text-2xl font-bold text-foreground mb-4">Error Loading Clients</h1>
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
    if (!subscription) return 'FREE';
    const tier = subscription.subscription_tier || 'freemium';
    // Show "FREE" instead of "FREEMIUM"
    if (tier === 'freemium') return 'FREE';
    return tier.toUpperCase();
  };

  // Get plan badge color
  const getPlanBadgeColor = () => {
    const tier = subscription?.subscription_tier || 'freemium';
    switch (tier) {
      case 'freemium':
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
        <div className="mb-8 text-center mt-[50px]">
          {/* Current Plan Badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border-2 ${getPlanBadgeColor()}`}>
              {getPlanLabel()}{subscription?.subscription_tier !== 'freemium' ? ' PLAN' : ''}
            </span>
          </div>

          {/* NZST Clock */}
          <div className="mb-6">
            <p className="text-4xl font-bold font-mono text-foreground">
              {currentTime}
            </p>
            <p className="text-lg text-muted-foreground mt-2">
              {currentDate}
            </p>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {(() => {
              const fullName = profile?.full_name || '';
              const firstName = fullName.split(' ')[0] || profile?.username || user?.email?.split('@')[0] || 'User';
              return firstName;
            })()}!
          </h1>
        </div>


        {/* Clients Section */}
        <div className="mb-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Your Clients
            </h2>
          </div>

          {clients.length === 0 ? (
            <div className="p-12 text-center">
              <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No clients yet
              </h3>
              <Link href="/dashboard/clients/new">
                <Button size="lg" className="px-8">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Client
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