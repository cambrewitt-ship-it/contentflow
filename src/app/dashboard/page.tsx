"use client";
import { User, Plus, Settings, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useState, useEffect } from "react";

interface Client {
  id: string;
  name: string;
  description?: string;
  company_description?: string;
  website_url?: string;
  brand_tone?: string;
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

export default function Dashboard() {
  const { user, signOut, getAccessToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        // Don't set error state for profile fetch failure
      }
    }

    fetchProfile();
  }, [user]);

  // Fetch user's clients
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching user clients for dashboard...');
        
        const response = await fetch('/api/clients', {
          headers: {
            'Authorization': `Bearer ${getAccessToken() || ''}`,
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
  }, [user, getAccessToken]);

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

  return (
    <div className="flex-1 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center mt-[50px]">
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
          <div className="mt-8">
            <div className="inline-block bg-gradient-to-r from-purple-600 to-purple-700 opacity-90 px-6 h-10 rounded-lg flex items-center justify-center">
              <div className="flex items-center justify-center h-full">
                <span className="text-lg text-white font-medium">
                  Select a client to get started
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer to push clients section halfway down */}
        <div className="h-[calc(30vh-210px)]"></div>

        {/* Clients Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Your Clients
            </h2>
          <Link href="/dashboard/clients/new">
            <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </Button>
            </Link>
          </div>

          {clients.length === 0 ? (
            <Card className="p-12 text-center">
              <CardContent className="p-0">
                <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No clients yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Get started by creating your first client to manage their social media content
                </p>
                <Link href="/dashboard/clients/new">
                  <Button size="lg" className="px-8">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Client
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {clients.map((client) => (
                <Card 
                  key={client.id} 
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 flex flex-col h-full opacity-90"
                >
                  <Link href={`/dashboard/client/${client.id}`}>
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-700">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl font-bold break-words leading-tight">
                            {client.name}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      {client.company_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {client.company_description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                        <span>Created {new Date(client.created_at).toLocaleDateString()}</span>
                        <span className="text-blue-600 font-medium">
                          View Details →
                        </span>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
} 