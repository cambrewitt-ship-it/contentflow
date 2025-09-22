"use client";
import { User, Plus, Settings, LogOut, Users, Calendar, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";
import UIThemeToggle from "../../components/UIThemeToggle";
import { useUIThemeStyles } from "../../hooks/useUITheme";
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
  const { getThemeClasses } = useUIThemeStyles();
  const { user, signOut, getAccessToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
        <div className="mb-8">
          <h1 className={getThemeClasses(
            "text-3xl font-bold text-foreground mb-2",
            "text-3xl font-bold glass-text-primary mb-2"
          )}>
            Welcome back, {profile?.username || profile?.full_name || user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className={getThemeClasses(
            "text-lg text-muted-foreground",
            "text-lg glass-text-secondary"
          )}>
            Manage your clients and create amazing social media content
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className={getThemeClasses(
            "p-6",
            "glass-card p-6"
          )}>
            <CardContent className="p-0">
              <div className="flex items-center">
                <Users className={getThemeClasses(
                  "h-8 w-8 text-blue-600",
                  "h-8 w-8 glass-text-primary"
                )} />
                <div className="ml-4">
                  <p className={getThemeClasses(
                    "text-2xl font-bold text-foreground",
                    "text-2xl font-bold glass-text-primary"
                  )}>
                    {clients.length}
                  </p>
                  <p className={getThemeClasses(
                    "text-sm text-muted-foreground",
                    "text-sm glass-text-muted"
                  )}>
                    Total Clients
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={getThemeClasses(
            "p-6",
            "glass-card p-6"
          )}>
            <CardContent className="p-0">
              <div className="flex items-center">
                <Calendar className={getThemeClasses(
                  "h-8 w-8 text-green-600",
            "h-8 w-8 glass-text-primary"
          )} />
                <div className="ml-4">
                  <p className={getThemeClasses(
                    "text-2xl font-bold text-foreground",
                    "text-2xl font-bold glass-text-primary"
                  )}>
                    0
                  </p>
                  <p className={getThemeClasses(
                    "text-sm text-muted-foreground",
                    "text-sm glass-text-muted"
                  )}>
                    Scheduled Posts
                  </p>
                </div>
        </div>
            </CardContent>
          </Card>

          <Card className={getThemeClasses(
            "p-6",
            "glass-card p-6"
          )}>
            <CardContent className="p-0">
              <div className="flex items-center">
                <FileText className={getThemeClasses(
                  "h-8 w-8 text-purple-600",
                  "h-8 w-8 glass-text-primary"
                )} />
                <div className="ml-4">
                  <p className={getThemeClasses(
                    "text-2xl font-bold text-foreground",
                    "text-2xl font-bold glass-text-primary"
                  )}>
                    0
                  </p>
        <p className={getThemeClasses(
                    "text-sm text-muted-foreground",
                    "text-sm glass-text-muted"
                  )}>
                    Projects
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className={getThemeClasses(
              "text-2xl font-bold text-foreground",
              "text-2xl font-bold glass-text-primary"
            )}>
              Your Clients
            </h2>
          <Link href="/dashboard/clients/new">
            <Button className={getThemeClasses(
                "flex items-center space-x-2",
                "flex items-center space-x-2 glass-button glass-button-primary"
              )}>
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </Button>
            </Link>
          </div>

          {clients.length === 0 ? (
            <Card className={getThemeClasses(
              "p-12 text-center",
              "glass-card p-12 text-center"
            )}>
              <CardContent className="p-0">
                <Users className={getThemeClasses(
                  "h-16 w-16 text-muted-foreground mx-auto mb-4",
                  "h-16 w-16 glass-text-muted mx-auto mb-4"
                )} />
                <h3 className={getThemeClasses(
                  "text-xl font-semibold text-foreground mb-2",
                  "text-xl font-semibold glass-text-primary mb-2"
                )}>
                  No clients yet
                </h3>
                <p className={getThemeClasses(
                  "text-muted-foreground mb-6",
                  "text-muted-foreground mb-6"
                )}>
                  Get started by creating your first client to manage their social media content
                </p>
                <Link href="/dashboard/clients/new">
                  <Button size="lg" className={getThemeClasses(
                    "px-8",
                    "px-8 glass-button glass-button-primary"
                  )}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Client
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <Card 
                  key={client.id} 
                  className={getThemeClasses(
                    "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                    "cursor-pointer transition-all hover:shadow-lg hover:scale-105 glass-card hover:bg-white/5"
                  )}
                >
                  <Link href={`/dashboard/client/${client.id}`}>
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className={getThemeClasses(
                          "w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-700",
                          "w-12 h-12 glass-card rounded-full flex items-center justify-center text-xl font-bold glass-text-primary"
                        )}>
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className={getThemeClasses(
                            "text-xl font-bold truncate",
                            "text-xl font-bold truncate glass-text-primary"
                          )}>
                            {client.name}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {client.company_description && (
                        <p className={getThemeClasses(
                          "text-sm text-muted-foreground line-clamp-2 mb-4",
                          "text-sm glass-text-muted line-clamp-2 mb-4"
                        )}>
                          {client.company_description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Created {new Date(client.created_at).toLocaleDateString()}</span>
                        <span className={getThemeClasses(
                          "text-blue-600 font-medium",
                          "glass-text-primary font-medium"
                        )}>
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

        {/* Theme Toggle */}
        <div className="flex justify-center">
          <div className="flex items-center">
            <UIThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
} 