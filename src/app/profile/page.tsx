"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Home } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    fetchProfile();
  }, [user, router]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: profile.full_name,
          username: profile.username,
          company_name: profile.company_name,
        })
        .eq('id', user?.id);

      if (error) throw error;
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load profile</p>
          <Button onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header with CM Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <Link href="/dashboard" className="block">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className="h-24 w-auto object-contain transition-all duration-300 cursor-pointer hover:opacity-80"
              />
            </Link>
          </div>
        </div>
        
        {/* Sidebar Content */}
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <Link href="/dashboard">
              <Button variant="outline" className="w-full justify-start">
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
            </div>
          </div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account information and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Update your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="full_name" className="text-sm font-medium">
                  Full Name
                </label>
                <Input
                  id="full_name"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  value={profile.username || ''}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  placeholder="Enter your username"
                />
                <p className="text-xs text-muted-foreground">
                  Choose a unique username. This will be used for @mentions and display purposes.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="company_name" className="text-sm font-medium">
                  Company Name
                </label>
                <Input
                  id="company_name"
                  value={profile.company_name || ''}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  placeholder="Enter your company name"
                />
              </div>


              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  {message}
                </div>
              )}

              <div className="flex space-x-4">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sign Out Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>
              Manage your account session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Sign Out</h4>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        </div>
      </div>
    </div>
  );
}
