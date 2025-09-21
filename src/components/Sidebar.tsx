"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIThemeStyles } from "hooks/useUITheme";
import { useAuth } from "contexts/AuthContext";
import { Card, CardContent } from "components/ui/card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { 
  Users, 
  Home, 
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  description?: string;
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
  const pathname = usePathname();
  const router = useRouter();
  const { getThemeClasses } = useUIThemeStyles();
  const { user, getAccessToken } = useAuth();

  // Fetch all clients from Supabase
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
  }, [user]);

  // Extract current client ID from pathname
  const currentClientId = pathname?.split('/')[2] || null;
  
  // Check if we're on a client-specific page
  const isOnClientPage = pathname?.includes('/dashboard/client/');
  
  // Check if we're on the main dashboard
  const isOnMainDashboard = pathname === '/dashboard';

  // Navigation items
  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      active: isOnMainDashboard
    }
  ];

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
          <p className="text-sm text-red-600 mb-2">Failed to load clients</p>
          <Button onClick={refreshClients} size="sm" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={getThemeClasses(
      `bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`,
      `glass-sidebar min-h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`
    )}>
      {/* Header with CM Logo and Collapse Button */}
      <div className={getThemeClasses(
        "p-4 border-b border-gray-200",
        "p-4 border-b border-white/20"
      )}>
        <div className="flex items-center justify-between">
          {/* CM Logo */}
          <div className="flex items-center justify-center">
            <img 
              src="/cm-logo.png" 
              alt="CM Logo" 
              className={`object-contain transition-all duration-300 ${
                collapsed ? 'h-8 w-8' : 'h-24 w-auto'
              }`}
            />
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

      {/* Navigation */}
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

      {/* Clients List */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!collapsed && (
          <div className="flex items-center justify-between mb-3">
            <h3 className={getThemeClasses(
              "text-sm font-medium text-gray-500",
              "text-sm font-medium glass-text-muted"
            )}>All Clients</h3>
            
            {/* Refresh Button */}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={refreshClients}
              title="Refresh clients list"
              className={getThemeClasses(
                "h-6 w-6 p-0",
                "h-6 w-6 p-0 glass-button"
              )}
            >
              <Loader2 className="w-3 h-3" />
            </Button>
          </div>
        )}
        
        {clients.length === 0 ? (
          <div className="text-center py-8">
            <Users className={getThemeClasses(
              "w-8 h-8 text-gray-400 mx-auto mb-2",
              "w-8 h-8 glass-text-muted mx-auto mb-2"
            )} />
            <p className={getThemeClasses(
              "text-sm text-gray-500",
              "text-sm glass-text-muted"
            )}>No clients yet</p>
            <p className={getThemeClasses(
              "text-xs text-gray-400",
              "text-xs glass-text-muted"
            )}>Create your first client to get started</p>
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
                      isActiveClient ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`,
                    `cursor-pointer transition-all glass-card ${
                      isActiveClient ? 'ring-2 ring-white/50' : 'hover:bg-white/5'
                    }`
                  )}
                  onClick={() => router.push(`/dashboard/client/${client.id}`)}
                  title={collapsed ? client.name : undefined}
                >
                  <CardContent className={`p-3 ${collapsed ? 'p-2' : ''}`}>
                    <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                      <div className={`${collapsed ? '' : 'flex-1 min-w-0'}`}>
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
                          <div className={getThemeClasses(
                            `rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700 ${
                              collapsed ? 'w-8 h-8' : 'w-6 h-6'
                            }`,
                            `rounded-full glass-card flex items-center justify-center text-xs font-medium glass-text-primary ${
                              collapsed ? 'w-8 h-8' : 'w-6 h-6'
                            }`
                          )}>
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          {!collapsed && (
                            <span className={getThemeClasses(
                              `font-medium truncate ${
                                isActiveClient ? 'text-blue-700' : 'text-gray-900'
                              }`,
                              `font-medium truncate ${
                                isActiveClient ? 'glass-text-primary' : 'glass-text-secondary'
                              }`
                            )}>
                              {client.name}
                            </span>
                          )}
                        </div>
                        {!collapsed && client.description && (
                          <p className={getThemeClasses(
                            "text-xs text-gray-500 truncate mt-1",
                            "text-xs glass-text-muted truncate mt-1"
                          )}>
                            {client.description}
                          </p>
                        )}
                      </div>
                      
                      {/* Active indicator */}
                      {!collapsed && isActiveClient && (
                        <Badge variant="secondary" className={getThemeClasses(
                          "text-xs bg-blue-100 text-blue-700",
                          "text-xs glass-card glass-text-primary"
                        )}>
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className={getThemeClasses(
          "p-4 border-t border-gray-200",
          "p-4 border-t border-white/20"
        )}>
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
