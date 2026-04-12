"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Module-level cache: set to true once we confirm the user has ≥1 client.
// Resets on hard page refresh (by design — keeps the gate accurate).
let profileCheckCache: boolean | null = null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, getAccessToken } = useAuth();
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialCheckDone, setTrialCheckDone] = useState(false);

  const isOnNewClientPage = pathname === '/dashboard/clients/new';

  // While checking the business-profile gate we show a loading state
  const [profileGateLoading, setProfileGateLoading] = useState(
    !isOnNewClientPage && profileCheckCache !== true
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && pathname?.startsWith('/dashboard')) {
      console.log('🔒 Not authenticated, redirecting to login...');
      router.push('/auth/login');
    }
  }, [user, loading, router, pathname]);

  // Trial expiry gate: if the trial has ended, block all dashboard access
  useEffect(() => {
    if (loading || !user) return;

    async function checkTrialExpiry() {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('subscription_tier, subscription_status, current_period_end')
          .eq('user_id', user!.id)
          .single();

        if (!error && data?.subscription_tier === 'trial') {
          // Expired if status is explicitly 'expired'
          const statusExpired = data.subscription_status === 'expired';
          // OR if the period end date has passed
          const dateExpired = !!data.current_period_end && new Date(data.current_period_end) < new Date();
          setTrialExpired(statusExpired || dateExpired);
        }
      } catch {
        // On unexpected error, don't block the user
      } finally {
        setTrialCheckDone(true);
      }
    }

    checkTrialExpiry();
  }, [user?.id, loading]);

  // Business-profile gate: block access to dashboard routes until the user
  // has created at least one client (business profile).
  useEffect(() => {
    if (loading || !user) return;

    // The creation page itself is always accessible — no gate needed
    if (isOnNewClientPage) {
      setProfileGateLoading(false);
      return;
    }

    // Already confirmed in this session
    if (profileCheckCache === true) {
      setProfileGateLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setProfileGateLoading(false);
      return;
    }

    setProfileGateLoading(true);

    fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const hasClients = (data.clients?.length ?? 0) > 0;
        if (hasClients) {
          profileCheckCache = true;
          setProfileGateLoading(false);
        } else {
          // No business profile yet — redirect to creation page
          router.replace('/dashboard/clients/new');
        }
      })
      .catch(() => {
        // On network error don't block the user indefinitely
        setProfileGateLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOnNewClientPage, loading]);

  // Show loading while authenticating or running the profile gate check
  if (loading || !user || profileGateLoading || !trialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>
            {loading
              ? 'Loading...'
              : profileGateLoading
              ? 'Setting up your workspace...'
              : 'Redirecting to login...'}
          </p>
        </div>
      </div>
    );
  }

  // Trial expired — lock out the entire dashboard
  if (trialExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="h-10 w-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Your Trial Has Ended</h1>
          <p className="text-muted-foreground mb-8">
            Your 14-day free trial has expired. Choose a plan to continue using Content Manager and keep your business profiles, content, and calendar.
          </p>
          <Link href="/pricing">
            <Button size="lg" className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              View Pricing Plans
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">
            Need help?{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">Contact us</Link>
          </p>
        </div>
      </div>
    );
  }
  
  const hideTopBar = false;

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Desktop Layout - CSS Grid */}
      <div className="hidden md:grid md:grid-cols-[auto_1fr] md:h-full">
        {/* Left Sidebar */}
        <div className={`
          transform transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Top Bar - Conditionally visible */}
          {!hideTopBar && (
            <div className="flex-shrink-0">
              <TopBar />
            </div>
          )}
          
          {/* Page Content - Scrollable content area only */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Layout - Overlay Sidebar */}
      <div className="md:hidden h-full relative">
        {/* Mobile Sidebar Overlay */}
        <div className={`
          fixed inset-y-0 left-0 z-40
          transform transition-all duration-300 ease-in-out
          shadow-lg
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Main Content */}
        <div className="flex flex-col h-full">
          {/* Top Bar - Conditionally visible */}
          {!hideTopBar && (
            <div className="flex-shrink-0">
              <TopBar />
            </div>
          )}
          
          {/* Page Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 