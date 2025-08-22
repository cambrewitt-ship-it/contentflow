"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "components/ui/card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { 
  Users, 
  Plus, 
  Home, 
  Calendar, 
  FileText, 
  Settings,
  Loader2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export default function Sidebar() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Fetch all clients from Supabase
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching all clients for sidebar...');
        
        const response = await fetch('/api/clients');
        
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
  }, []);

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
    },
    {
      name: 'Scheduler',
      href: isOnClientPage ? `/dashboard/client/${currentClientId}/project/1/scheduler` : '/dashboard',
      icon: Calendar,
      active: pathname?.includes('/scheduler')
    },
    {
      name: 'Content Suite',
      href: isOnClientPage ? `/dashboard/client/${currentClientId}/project/1/content-suite` : '/dashboard',
      icon: FileText,
      active: pathname?.includes('/content-suite')
    }
  ];

  // Refresh clients list (can be called after creating new clients)
  const refreshClients = () => {
    setLoading(true);
    fetch('/api/clients')
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
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
        </div>
        
        {/* Create New Client Button */}
        <div className="flex gap-2">
          <Link href="/dashboard/clients/new" className="flex-1">
            <Button size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              New Client
            </Button>
          </Link>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={refreshClients}
            title="Refresh clients list"
          >
            <Loader2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Navigation</h3>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className={`w-full justify-start ${
                    item.active ? "bg-blue-50 text-blue-700 border-blue-200" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Clients List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-500 mb-3">All Clients</h3>
        
        {clients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No clients yet</p>
            <p className="text-xs text-gray-400">Create your first client to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => {
              const isActive = currentClientId === client.id;
              const isActiveClient = pathname?.includes(`/dashboard/client/${client.id}`);
              
              return (
                <Card 
                  key={client.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isActiveClient ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => router.push(`/dashboard/client/${client.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className={`font-medium truncate ${
                            isActiveClient ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {client.name}
                          </span>
                        </div>
                        {client.description && (
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {client.description}
                          </p>
                        )}
                      </div>
                      
                      {/* Active indicator */}
                      {isActiveClient && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
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
      <div className="p-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-xs text-gray-400">
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
