"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIThemeStyles } from "@/hooks/useUITheme";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Home,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Clock,
  CreditCard,
  Calendar,
  Images,
  Bot,
  Sparkles,
  PenSquare,
  Link2,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { isSingleClientTier } from "@/lib/tierUtils";

interface Client {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  created_at: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { getThemeClasses } = useUIThemeStyles();
  const { user, getAccessToken } = useAuth();
  
  // Determine if Home button should be shown based on subscription tier
  // Single-client tiers (Free, In-House) don't need a Home button
  // Multi-client tiers (Freelancer, Agency) need Home to navigate between clients
  const showHomeButton = !isSingleClientTier(subscriptionTier);

  // Fetch subscription tier to determine if Home button should be shown
  useEffect(() => {
    async function fetchSubscription() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('subscription_tier, current_period_end')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription for sidebar:', error);
          setSubscriptionTier('trial');
        } else if (data) {
          setSubscriptionTier(data.subscription_tier);
          console.log('📊 Sidebar: User subscription tier:', data.subscription_tier,
            '| Show Home:', !isSingleClientTier(data.subscription_tier));

          // Calculate trial days remaining
          if (data.subscription_tier === 'trial' && data.current_period_end) {
            const end = new Date(data.current_period_end);
            const now = new Date();
            const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            setTrialDaysRemaining(Math.max(0, days));
          }
        } else {
          setSubscriptionTier('trial');
        }
      } catch (err) {
        console.error('Error fetching subscription for sidebar:', err);
        setSubscriptionTier('freemium');
      }
    }

    fetchSubscription();
  }, [user?.id]);

  // Fetch all clients from Supabase - ONLY on mount
  useEffect(() => {
    async function fetchClients() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching all clients for sidebar...');
        
        const response = await fetch('/api/clients', {
          headers: {
            'Authorization': `Bearer ${getAccessToken() || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch clients: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Clients fetched successfully:', data.clients);
        
        setClients(data.clients || []);
      } catch (err) {
        console.error('❌ Error fetching clients:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch clients');
      } finally {
        setLoading(false);
      }
    }

    fetchClients();

    // Listen for client creation events to refresh the sidebar
    const handleClientCreated = () => {
      console.log('🔄 Client created event received, refreshing sidebar...');
      fetchClients();
    };

    window.addEventListener('clientCreated', handleClientCreated);

    // Cleanup event listener
    return () => {
      window.removeEventListener('clientCreated', handleClientCreated);
    };
  }, [user?.id]); // ✅ Only depend on user ID, not entire user object

  // Extract current client ID from pathname
  const currentClientId = pathname?.split('/')[2] || null;

  // Check if we're on a client-specific page
  const isOnClientPage = pathname?.includes('/dashboard/client/');

  // Robustly extract clientId for per-client navigation links
  const clientIdFromPath = pathname?.match(/\/dashboard\/client\/([^/]+)/)?.[1] || null;
  
  // Check if we're on the main dashboard
  const isOnMainDashboard = pathname === '/dashboard';

  // Navigation items - conditionally include Home based on subscription tier
  // Single-client tiers (Free, In-House) don't need Home since they're redirected to client
  // Multi-client tiers (Freelancer, Agency) need Home to navigate between clients
  const navItems = showHomeButton 
    ? [
        {
          name: 'Home',
          href: '/dashboard',
          icon: Home,
          active: isOnMainDashboard
        }
      ]
    : [];

  // Refresh clients list (can be called after creating new clients)
  const refreshClients = () => {
    if (!user) return;
    
    setLoading(true);
    fetch('/api/clients', {
      headers: {
        'Authorization': `Bearer ${getAccessToken() || ''}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        setClients(data.clients || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error refreshing clients:', err);
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 p-4 min-h-screen">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 p-4 min-h-screen">
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-2">Failed to load profiles</p>
          <Button onClick={refreshClients} size="sm" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={getThemeClasses(
        `bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`,
        `glass-sidebar min-h-screen flex flex-col transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`
      )}
      style={{
        background: 'white',
        backgroundImage: 'none'
      }}
    >
      {/* Header with CM Logo and Collapse Button */}
      <div className={getThemeClasses(
        "p-4 border-b border-gray-200",
        "p-4 border-b border-white/20"
      )}>
        <div className="flex items-center justify-between">
          {/* CM Logo */}
          <div className="flex items-center justify-center">
            <Link href="/dashboard" className="block">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className={`object-contain transition-all duration-300 cursor-pointer hover:opacity-80 ${
                  collapsed ? 'h-8 w-8' : 'h-24 w-auto'
                }`}
              />
            </Link>
          </div>
          
          {/* Collapse Button - Desktop Only */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={`hidden md:flex h-8 w-8 p-0 hover:bg-gray-100 ${
              collapsed ? 'ml-0' : 'ml-2'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation - Only show if there are nav items (multi-client tiers) */}
      {navItems.length > 0 && (
        <div className={getThemeClasses(
          "p-4 border-b border-gray-200",
          "p-4 border-b border-white/20"
        )}>
          {!collapsed && (
            <h3 className={getThemeClasses(
              "text-sm font-medium text-gray-500 mb-3",
              "text-sm font-medium glass-text-muted mb-3"
            )}>Navigation</h3>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={item.active ? "secondary" : "ghost"}
                    className={getThemeClasses(
                      `w-full ${collapsed ? 'justify-center px-2' : 'justify-start'} ${
                        item.active ? "bg-blue-50 text-blue-700 border-blue-200" : "text-gray-700 hover:bg-gray-50"
                      }`,
                      `w-full ${collapsed ? 'justify-center px-2' : 'justify-start'} glass-button ${
                        item.active ? "glass-text-primary" : "glass-text-secondary hover:glass-text-primary"
                      }`
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
                    {!collapsed && item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Client navigation — shown when viewing a specific client */}
      {isOnClientPage && clientIdFromPath && (
        <div className={getThemeClasses(
          "p-4 border-b border-gray-200",
          "p-4 border-b border-white/20"
        )}>
          {!collapsed && (
            <h3 className={getThemeClasses(
              "text-sm font-medium text-gray-500 mb-3",
              "text-sm font-medium glass-text-muted mb-3"
            )}>Client</h3>
          )}
          <nav className="space-y-1">
            {[
              {
                name: "Content Suite",
                href: `/dashboard/client/${clientIdFromPath}/content-suite`,
                icon: PenSquare,
                active: !!pathname?.includes("/content-suite"),
              },
              {
                name: "Calendar",
                href: `/dashboard/client/${clientIdFromPath}/calendar`,
                icon: Calendar,
                active: !!pathname?.includes("/calendar"),
              },
              {
                name: "Media Gallery",
                href: `/dashboard/client/${clientIdFromPath}/media-gallery`,
                icon: Images,
                active: !!pathname?.includes("/media-gallery"),
              },
              {
                name: "Autopilot ✨",
                href: `/dashboard/client/${clientIdFromPath}/autopilot`,
                icon: Sparkles,
                active: !pathname?.includes("/autopilot-settings") && !!pathname?.includes("/autopilot"),
              },
              {
                name: "Connect",
                href: `/dashboard/client/${clientIdFromPath}/connect-platforms`,
                icon: Link2,
                active: !!pathname?.includes("/connect-platforms"),
              },
              {
                name: "Settings",
                href: `/dashboard/client/${clientIdFromPath}/autopilot-settings`,
                icon: Settings,
                active: !!pathname?.includes("/autopilot-settings"),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={item.active ? "secondary" : "ghost"}
                    className={getThemeClasses(
                      `w-full ${collapsed ? "justify-center px-2" : "justify-start"} ${
                        item.active
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`,
                      `w-full ${collapsed ? "justify-center px-2" : "justify-start"} glass-button ${
                        item.active
                          ? "glass-text-primary"
                          : "glass-text-secondary hover:glass-text-primary"
                      }`
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className={`w-4 h-4 ${collapsed ? "" : "mr-2"}`} />
                    {!collapsed && item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Clients List */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!collapsed && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className={getThemeClasses(
                "text-sm font-medium text-gray-500",
                "text-sm font-medium glass-text-muted"
              )}>All Profiles</h3>
              
              <div className="flex items-center gap-2">
                {/* Add Client Button */}
                <Link href="/dashboard/clients/new">
                  <Button 
                    size="sm" 
                    variant="outline"
                    title="Add new business profile"
                    className={getThemeClasses(
                      "h-6 px-2 text-xs",
                      "h-6 px-2 text-xs glass-button"
                    )}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </Link>
                
                {/* Refresh Button */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={refreshClients}
                  title="Refresh profiles list"
                  className={getThemeClasses(
                    "h-6 w-6 p-0",
                    "h-6 w-6 p-0 glass-button"
                  )}
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {clients.length === 0 ? (
              <div className="text-center py-8">
                <Users className={getThemeClasses(
                  "w-8 h-8 text-gray-400 mx-auto mb-2",
                  "w-8 h-8 glass-text-muted mx-auto mb-2"
                )} />
                <p className={getThemeClasses(
                  "text-sm text-gray-500",
                  "text-sm glass-text-muted"
                )}>No profiles yet</p>
                <p className={getThemeClasses(
                  "text-xs text-gray-400",
                  "text-xs glass-text-muted"
                )}>Create your first profile to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => {
                  const isActive = currentClientId === client.id;
                  const isActiveClient = pathname?.includes(`/dashboard/client/${client.id}`);
                  
                  return (
                    <Card 
                      key={client.id} 
                      className={getThemeClasses(
                        `cursor-pointer transition-all hover:shadow-md ${
                          isActiveClient ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                        }`,
                        `cursor-pointer transition-all glass-card ${
                          isActiveClient ? 'ring-2 ring-white/50' : 'hover:bg-white/5'
                        }`
                      )}
                      onClick={() => router.push(`/dashboard/client/${client.id}`)}
                      title={client.name}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`rounded-full flex items-center justify-center overflow-hidden w-6 h-6 ${
                                client.logo_url ? '' : getThemeClasses(
                                  "bg-blue-100 text-xs font-medium text-blue-700",
                                  "glass-card text-xs font-medium glass-text-primary"
                                )
                              }`}>
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
                              <span className={getThemeClasses(
                                "font-bold truncate text-gray-600",
                                "font-bold truncate glass-text-secondary"
                              )} style={{ fontSize: '20px', fontWeight: '800' }}>
                                {client.name}
                              </span>
                            </div>
                            {client.description && (
                              <p className={getThemeClasses(
                                "text-xs text-gray-500 truncate mt-1",
                                "text-xs glass-text-muted truncate mt-1"
                              )}>
                                {client.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className={getThemeClasses(
          "p-4 border-t border-gray-200 space-y-3",
          "p-4 border-t border-white/20 space-y-3"
        )}>
          {/* Trial Days Remaining */}
          {subscriptionTier === 'trial' && trialDaysRemaining !== null && trialDaysRemaining > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-orange-700">
                  {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
              <button
                onClick={async () => {
                  const priceId = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID;
                  if (!priceId) return;
                  const token = getAccessToken();
                  if (!token) {
                    window.location.href = '/pricing';
                    return;
                  }
                  try {
                    const res = await fetch('/api/stripe/checkout', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                      body: JSON.stringify({ priceId }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch {
                    window.location.href = '/pricing';
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-1.5 px-3 rounded-md transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Add billing details
              </button>
            </div>
          )}
          <div className="text-center">
            <p className={getThemeClasses(
              "text-xs text-gray-400",
              "text-xs glass-text-muted"
            )}>
              {clients.length} client{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
