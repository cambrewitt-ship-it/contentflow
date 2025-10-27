"use client";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch user profile - ONLY on mount or when user ID changes
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
      }
    }

    fetchProfile();
  }, [user?.id]); // ✅ Only depend on user ID, not fetchProfile function

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className="h-16 w-auto object-contain"
              />
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    Welcome, {profile?.username || profile?.full_name || user.email}
                  </span>
                  <Link href="/dashboard">
                    <Button size="sm">Dashboard</Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={async () => {
                    await signOut();
                    router.push('/');
                  }}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link href="/auth/login">
                    <Button variant="outline" size="sm" className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm">
                      Get Started FREE
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="bg-background/80 backdrop-blur-sm"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {/* Navigation Links */}
                <a 
                  href="#features" 
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#pricing" 
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                
                {/* Auth Section */}
                <div className="pt-4 pb-3 border-t border-border/40">
                  {user ? (
                    <div className="space-y-3">
                      <div className="px-3 py-2">
                        <p className="text-sm text-muted-foreground">
                          Welcome, {profile?.username || profile?.full_name || user.email}
                        </p>
                      </div>
                      <div className="px-3">
                        <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                          <Button size="sm" className="w-full">
                            Dashboard
                          </Button>
                        </Link>
                      </div>
                      <div className="px-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={async () => {
                            await signOut();
                            router.push('/');
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-3">
                        <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="outline" size="sm" className="w-full bg-white text-gray-900 hover:bg-gray-50 border-gray-300">
                            Sign In
                          </Button>
                        </Link>
                      </div>
                      <div className="px-3">
                        <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                          <Button size="sm" className="w-full">
                            Get Started FREE
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              AI-Powered Social Media Management
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl mx-auto">
              Upload content, generate captions with AI, and schedule posts across all platforms. 
              Built specifically for marketing agencies managing multiple clients.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3 max-w-2xl mx-auto px-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 text-base rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
              />
              <Button 
                size="lg" 
                className="px-8 py-3 text-base whitespace-nowrap" 
                onClick={() => {
                  if (user) {
                    router.push('/dashboard');
                  } else {
                    const signupUrl = email 
                      ? `/auth/signup?email=${encodeURIComponent(email)}`
                      : '/auth/signup';
                    router.push(signupUrl);
                  }
                }}
              >
                Get Started FREE
              </Button>
            </div>
          </div>
          
          {/* Hero Image/Illustration */}
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                      <div className="text-blue-600 text-4xl">📸</div>
                    </div>
                    <div className="h-20 bg-muted rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                      <div className="text-green-600 text-2xl">✨</div>
                    </div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-20 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                      <div className="text-purple-600 text-4xl">📅</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to manage social media content
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Streamline your social media workflow with AI-powered tools designed for marketing agencies.
            </p>
          </div>
          
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-blue-600 text-2xl">🤖</div>
                  </div>
                  <CardTitle>AI Caption Generation</CardTitle>
                  <CardDescription>
                    Automatically generate engaging captions for any image or video with our advanced AI technology.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Context-aware caption suggestions</li>
                    <li>• Brand voice customization</li>
                    <li>• Multiple caption variations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-green-600 text-2xl">👥</div>
                  </div>
                  <CardTitle>Client Management</CardTitle>
                  <CardDescription>
                    Organize content campaigns by client with brand-specific guidelines and approval workflows.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Client-specific brand guidelines</li>
                    <li>• Approval workflow management</li>
                    <li>• Content organization by client</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-purple-600 text-2xl">📅</div>
                  </div>
                  <CardTitle>Smart Scheduling</CardTitle>
                  <CardDescription>
                    Drag-and-drop calendar scheduling across Instagram, Facebook, and LinkedIn with optimal timing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Visual calendar interface</li>
                    <li>• Optimal posting times</li>
                    <li>• Multi-platform scheduling</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ready to transform your social media workflow?
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Join thousands of marketing agencies using Content Manager to streamline their social media management.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" className="px-8 py-3 text-base" asChild>
                <a href="/dashboard">Start Free Trial</a>
              </Button>
              <Button variant="outline" size="lg" className="px-8 py-3 text-base">
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-foreground">Content Manager</h3>
            </div>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40">
            <p className="text-sm text-muted-foreground text-center">
              © 2024 Content Manager. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
