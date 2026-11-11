"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Loader2,
  AlertCircle,
  Plus,
  RotateCcw,
  Clock,
  CreditCard,
  Calendar,
  Images,
  BarChart3,
  MessagesSquare,
  ShieldCheck,
  Bot,
  PenSquare,
  Link2,
  Settings,
  Check,
  ChevronsUpDown,
  LayoutGrid,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { isSingleClientTier } from "@/lib/tierUtils";
import { cn } from "@/lib/utils";

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
  const { user, getAccessToken } = useAuth();

  // Href of a nav item that was just clicked. Highlights it immediately
  // instead of waiting for the route transition to finish.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);
  
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
          .select('subscription_tier, subscription_status, current_period_end')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription for sidebar:', error);
          setSubscriptionTier('trial');
        } else if (data) {
          setSubscriptionTier(data.subscription_tier);
          console.log('📊 Sidebar: User subscription tier:', data.subscription_tier,
            '| Show Home:', !isSingleClientTier(data.subscription_tier));

          // Calculate trial days remaining (legacy no-CC trial tier, or a
          // real paid tier currently in its Stripe-managed trial period)
          if ((data.subscription_tier === 'trial' || data.subscription_status === 'trialing') && data.current_period_end) {
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

  // ── Brand / workspace selector state ────────────────────────────────
  // A brand that was just picked in the selector. Shown as the current brand
  // straight away while the route transition finishes.
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);
  useEffect(() => {
    setSwitchingToId(null);
  }, [pathname]);

  const isSingleBrand = clients.length === 1;
  const selectedClientId = switchingToId ?? clientIdFromPath;
  // One brand: that brand is the workspace everywhere. Several: the brand in the URL.
  const currentClient = isSingleBrand
    ? clients[0]
    : clients.find((c) => c.id === selectedClientId) ?? null;

  const switchToClient = (clientId: string) => {
    if (pathname === `/dashboard/client/${clientId}`) return;
    setSwitchingToId(clientId);
    router.push(`/dashboard/client/${clientId}`);
  };

  const prefetchClients = () => {
    clients.forEach((c) => router.prefetch(`/dashboard/client/${c.id}`));
  };

  // Profile-specific navigation, grouped for scanning. Same destinations as before.
  const clientNavGroups = clientIdFromPath
    ? [
        {
          label: "Content",
          items: [
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
              name: "Content Agent",
              href: `/dashboard/client/${clientIdFromPath}/autopilot`,
              icon: Bot,
              active: !pathname?.includes("/autopilot-settings") && !!pathname?.includes("/autopilot"),
            },
          ],
        },
        {
          label: "Engage",
          items: [
            {
              name: "Analytics",
              href: `/dashboard/client/${clientIdFromPath}/analytics`,
              icon: BarChart3,
              active: !!pathname?.includes("/analytics"),
            },
            {
              name: "Comments",
              href: `/dashboard/client/${clientIdFromPath}/comments`,
              icon: MessagesSquare,
              active: !!pathname?.includes("/comments"),
            },
            {
              name: "Feed Checker",
              href: `/dashboard/client/${clientIdFromPath}/feed-checker`,
              icon: ShieldCheck,
              active: !!pathname?.includes("/feed-checker"),
            },
          ],
        },
        {
          label: "Setup",
          items: [
            {
              name: "Social Accounts",
              href: `/dashboard/client/${clientIdFromPath}/connect-platforms`,
              icon: Link2,
              active: !!pathname?.includes("/connect-platforms"),
            },
            {
              name: "Agent Settings",
              href: `/dashboard/client/${clientIdFromPath}/autopilot-settings`,
              icon: Settings,
              active: !!pathname?.includes("/autopilot-settings"),
            },
          ],
        },
      ]
    : [];

  // The brand's own dashboard (/dashboard/client/[id]), previously reached by
  // clicking the profile card in the sidebar list.
  const brandHomeItem =
    isOnClientPage && clientIdFromPath
      ? {
          name: "Overview",
          href: `/dashboard/client/${clientIdFromPath}`,
          icon: LayoutDashboard,
          active: pathname === `/dashboard/client/${clientIdFromPath}`,
        }
      : null;

  const renderNavItem = (item: { name: string; href: string; icon: LucideIcon; active: boolean }) => (
    <SidebarNavItem
      key={item.name}
      {...item}
      active={pendingHref ? pendingHref === item.href : item.active}
      collapsed={collapsed}
      onNavigate={() => setPendingHref(item.href)}
    />
  );

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "h-full flex flex-col border-r border-gray-200/80 bg-white/85 backdrop-blur-xl transition-[width] duration-300 ease-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className={cn("flex items-center h-16 shrink-0", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          aria-label="Content Manager home"
        >
          <img
            src="/cm-logo.png"
            alt="Content Manager"
            className={cn(
              "object-contain mix-blend-multiply transition-all duration-300",
              collapsed ? "h-7 w-11" : "h-8 w-14"
            )}
          />
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 whitespace-nowrap">
              Content Manager
            </span>
          )}
        </Link>
      </div>

      {/* ── Brand / workspace selector ───────────────────────────────── */}
      <div className={cn("shrink-0 pb-3", collapsed ? "px-2" : "px-3")}>
        <BrandSelector
          clients={clients}
          currentClient={currentClient}
          activeClientId={selectedClientId}
          loading={loading}
          error={error}
          collapsed={collapsed}
          isSingleBrand={isSingleBrand}
          switching={!!switchingToId}
          onSelect={switchToClient}
          onOpen={prefetchClients}
          onRefresh={refreshClients}
        />
      </div>

      <div className={cn("h-px bg-gray-200/70 shrink-0", collapsed ? "mx-3" : "mx-4")} />

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className={cn("flex-1 overflow-y-auto py-3 space-y-4", collapsed ? "px-2" : "px-3")}>
        {(navItems.length > 0 || brandHomeItem) && (
          <div className="space-y-0.5">
            {navItems.map(renderNavItem)}
            {brandHomeItem && renderNavItem(brandHomeItem)}
          </div>
        )}

        {isOnClientPage &&
          clientIdFromPath &&
          clientNavGroups.map((group, i) => (
            <div key={group.label}>
              {collapsed ? (
                (i > 0 || navItems.length > 0 || brandHomeItem) && <div className="mx-2 mb-3 h-px bg-gray-200/70" />
              ) : (
                <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>
            </div>
          ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-gray-200/70 space-y-2",
          collapsed ? "p-2" : "p-3",
          // On mobile the collapse toggle is hidden; drop the empty footer unless the trial note shows
          !(trialDaysRemaining !== null && trialDaysRemaining > 0) && "hidden md:block"
        )}
      >
        {/* Trial Days Remaining (legacy no-CC trial, or a real tier's Stripe trial) */}
        {!collapsed && trialDaysRemaining !== null && trialDaysRemaining > 0 && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-medium text-amber-800">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in your trial
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
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/60 text-xs font-medium py-1.5 px-3 shadow-xs transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Add billing details
            </button>
          </div>
        )}

        {/* Collapse toggle - desktop only */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              "hidden md:flex h-8 items-center rounded-lg text-[13px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              collapsed ? "w-full justify-center" : "w-full gap-2 px-3"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Brand avatar ─────────────────────────────────────────────────────────

function BrandAvatar({ client, size = "md" }: { client: Pick<Client, "name" | "logo_url">; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-6 w-6 rounded-md text-[11px]" : "h-8 w-8 rounded-lg text-[13px]";
  if (client.logo_url) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden bg-white ring-1 ring-gray-200/80", dims)}>
        <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 flex items-center justify-center font-semibold text-blue-700 bg-gradient-to-br from-blue-100 to-cyan-100/70 ring-1 ring-blue-200/60",
        dims
      )}
    >
      {client.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ── Brand / workspace selector ───────────────────────────────────────────

interface BrandSelectorProps {
  clients: Client[];
  currentClient: Client | null;
  activeClientId: string | null;
  loading: boolean;
  error: string | null;
  collapsed: boolean;
  isSingleBrand: boolean;
  switching: boolean;
  onSelect: (clientId: string) => void;
  onOpen: () => void;
  onRefresh: () => void;
}

function BrandSelector({
  clients,
  currentClient,
  activeClientId,
  loading,
  error,
  collapsed,
  isSingleBrand,
  switching,
  onSelect,
  onOpen,
  onRefresh,
}: BrandSelectorProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const showSearch = clients.length > 6;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  const shell = cn(
    "group flex w-full items-center rounded-xl text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/40",
    collapsed ? "justify-center p-1.5" : "gap-2.5 px-2 py-2"
  );

  // Loading: compact skeleton in place of the selector
  if (loading && clients.length === 0) {
    return (
      <div className={cn(shell, "border border-gray-200/80 bg-white")} aria-busy="true">
        <span className="h-8 w-8 shrink-0 rounded-lg bg-gray-100 animate-pulse" />
        {!collapsed && <span className="h-3 flex-1 rounded bg-gray-100 animate-pulse" />}
      </div>
    );
  }

  if (error) {
    return collapsed ? (
      <button type="button" onClick={onRefresh} title="Failed to load profiles — retry" className={cn(shell, "border border-red-200 bg-red-50")}>
        <AlertCircle className="h-4 w-4 text-red-500" />
      </button>
    ) : (
      <div className="rounded-xl border border-red-200/80 bg-red-50/70 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load profiles
        </div>
        <button type="button" onClick={onRefresh} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline">
          <RotateCcw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  // No brands yet: a single, clear call to action
  if (clients.length === 0) {
    return (
      <Link
        href="/dashboard/clients/new"
        title="Add your brand"
        className={cn(shell, "border border-dashed border-gray-300 text-gray-600 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700")}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-blue-100">
          <Plus className="h-4 w-4" />
        </span>
        {!collapsed && <span className="text-[13px] font-medium">Add your brand</span>}
      </Link>
    );
  }

  // One brand: it's simply the workspace. No dropdown, no switching.
  if (isSingleBrand && currentClient) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href={`/dashboard/client/${currentClient.id}`}
          title={currentClient.name}
          className={cn(shell, "flex-1 min-w-0 hover:bg-gray-100/70")}
        >
          <BrandAvatar client={currentClient} />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-gray-900">{currentClient.name}</span>
              <span className="block truncate text-[11px] text-gray-500">Workspace</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <Link
            href="/dashboard/clients/new"
            title="Add brand"
            aria-label="Add brand"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Plus className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  // Several brands: dropdown switcher
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          onOpen();
          setQuery("");
          if (showSearch) setTimeout(() => searchRef.current?.focus(), 0);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={currentClient?.name ?? "Choose a brand"}
          className={cn(
            shell,
            "border border-gray-200/80 bg-white shadow-xs hover:border-gray-300 hover:shadow-sm data-[state=open]:border-blue-300 data-[state=open]:ring-[3px] data-[state=open]:ring-blue-500/10"
          )}
        >
          {currentClient ? (
            <BrandAvatar client={currentClient} />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <LayoutGrid className="h-4 w-4" />
            </span>
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-gray-900">
                  {currentClient?.name ?? "All brands"}
                </span>
                <span className="block truncate text-[11px] text-gray-500">
                  {currentClient ? "Switch brand" : "Choose a brand"}
                </span>
              </span>
              {switching ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-gray-600" />
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "bottom"}
        align="start"
        sideOffset={collapsed ? 10 : 6}
        className="w-64 p-1.5"
      >
        {showSearch && (
          <div className="relative px-1 pb-1.5 pt-0.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Keep Radix menu typeahead from swallowing keystrokes
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "Escape") e.stopPropagation();
              }}
              placeholder="Find a brand…"
              aria-label="Find a brand"
              className="h-8 w-full rounded-lg border border-gray-200/80 bg-white/80 pl-8 pr-2 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-500/10"
            />
          </div>
        )}
        <DropdownMenuLabel className="px-2 pt-1 pb-1">Brands</DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {filtered.map((client) => {
            const isActive = client.id === activeClientId;
            return (
              <DropdownMenuItem
                key={client.id}
                onSelect={() => onSelect(client.id)}
                className={cn("gap-2.5 py-1.5 cursor-pointer", isActive && "bg-blue-50 text-blue-700")}
                title={client.name}
              >
                <BrandAvatar client={client} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{client.name}</span>
                {isActive && <Check className="!text-blue-600" />}
              </DropdownMenuItem>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-gray-500">No brands match “{query}”</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer text-[13px]">
          <Link href="/dashboard/clients/new">
            <Plus />
            Add brand
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-[13px]"
          onSelect={(e) => {
            e.preventDefault();
            onRefresh();
          }}
        >
          <RotateCcw className={cn(loading && "animate-spin")} />
          Refresh list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Navigation item ──────────────────────────────────────────────────────

interface SidebarNavItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}

function SidebarNavItem({ name, href, icon: Icon, active, collapsed, onNavigate }: SidebarNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={collapsed ? name : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 w-full items-center rounded-lg text-[13px] font-medium outline-none transition-colors duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500/40",
        collapsed ? "justify-center px-2" : "justify-start gap-2.5 px-3",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
        )}
        strokeWidth={active ? 2.25 : 2}
      />
      {!collapsed && <span className="truncate">{name}</span>}
      {/* Instant tooltip in collapsed mode (native title tooltips lag ~1s) */}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {name}
        </span>
      )}
    </Link>
  );
}
