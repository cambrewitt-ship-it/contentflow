"use client";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, Check, Plug } from "lucide-react";
import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon, 
  TikTokIcon, 
  YouTubeIcon, 
  ThreadsIcon 
} from "@/components/social-icons";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

const pricingTiers = [
  {
    name: 'Free',
    id: 'freemium',
    price: 0,
    description: 'Available to everyone',
    features: [
      '1 Client profile',
      'AI copy generation',
      'AI content ideas',
      'Content calendar',
      '10 AI Credits per month',
    ],
    highlighted: false,
  },
  {
    name: 'Starter',
    id: 'starter',
    price: 35,
    description: 'For marketing managers',
    trialText: '14-day free trial',
    features: [
      'Everything in Free',
      '30 Posts per month',
      'Email Support',
      '100 AI Credits per month',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    id: 'professional',
    price: 79,
    description: 'For freelancers and agencies',
    trialText: '14-day free trial',
    features: [
      'Everything in Starter',
      '5 Client profiles',
      '150 Scheduled posts per month',
      '500 AI Credits per month',
    ],
    highlighted: true,
  },
  {
    name: 'Agency',
    id: 'agency',
    price: 199,
    description: 'For larger marketing agencies',
    trialText: '14-day free trial',
    features: [
      'Everything in Professional',
      'Unlimited Client profiles',
      'Unlimited Scheduled posts',
      'White-Label Branding',
      '2,000 AI Credits per month',
    ],
    highlighted: false,
  },
];

export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check for password reset hash fragments and redirect if needed
  // This handles cases where Supabase redirects to the home page instead of reset-password
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
      <section className="relative overflow-hidden bg-background pt-20 sm:pt-32 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              AI-Powered Social Media Management
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl mx-auto">
              Upload content, generate captions with AI, and schedule posts across all platforms.
            </p>
            <div className="mt-10 max-w-2xl mx-auto px-4">
              <div className="flex items-center justify-center gap-3">
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
              <p className="text-center text-sm text-muted-foreground mt-3">
                Free forever. No credit card required.
              </p>
            </div>
          </div>
          
          {/* Hero Image/Illustration */}
          <div className="mt-12 mx-auto max-w-5xl">
            <div className="flex flex-col items-center mb-6">
              <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-2 whitespace-nowrap block">
                Content Manager - Plan, Create, Schedule
              </h2>
              <p className="text-xl sm:text-2xl font-bold text-muted-foreground block text-center">
                Like ChatGPT + Trello + Social Scheduler
              </p>
            </div>
            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-3xl p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col lg:flex-row items-center lg:items-center gap-6 sm:gap-10">
                  <div className="w-full lg:max-w-md">
                    <div className="flex items-center justify-center lg:justify-start gap-4">
                      <div className="flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 text-primary">
                        <Plug className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight text-center lg:text-left">
                        Plug in Your Brand
                        <span className="block">Info and Voice</span>
                      </h3>
                    </div>
                  </div>
                  <img
                    src="/brand-info.png"
                    alt="Brand info configuration"
                    className="w-full lg:w-1/2 max-w-xl rounded-2xl shadow-xl"
                  />
                </div>
              </div>
            </div>
            <div className="mt-10 mb-8 text-center text-foreground">
              <p className="text-3xl sm:text-5xl font-extrabold">
                Generate content with our AI copy assistant
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold">
                Tailored to your brand.
              </p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-2xl">
                <img 
                  src="/content-suite-screenshot.png" 
                  alt="Content Suite Screenshot" 
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>
            <div className="mt-8 text-center text-foreground">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get Content Ideas for your context
              </h2>
              <p className="mt-4 text-xl leading-8 text-muted-foreground">
                Kill writers block
              </p>
            </div>
            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img 
                  src="/ideas-generator.png" 
                  alt="Content Ideas Screenshot" 
                  className="w-full h-auto rounded-lg max-w-4xl mx-auto"
                />
              </div>
            </div>
            <div className="mt-12">
              <div className="mx-auto max-w-4xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-12">
                  Schedule to social media
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-8 items-center justify-items-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center transition-transform hover:scale-110">
                      <FacebookIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Facebook</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center transition-transform hover:scale-110">
                      <InstagramIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Instagram</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <TwitterIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Twitter</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center transition-transform hover:scale-110">
                      <LinkedInIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">LinkedIn</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <TikTokIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">TikTok</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center transition-transform hover:scale-110">
                      <YouTubeIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">YouTube</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <ThreadsIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Threads</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-12 text-center text-foreground">
              <h2 className="text-4xl sm:text-5xl font-bold">
                Shared Client Workspace
              </h2>
              <p className="mt-4 text-xl text-muted-foreground">
                Streamline content calendars and approvals with our client portal
              </p>
            </div>
            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img
                  src="/client-portal-screenshot.png"
                  alt="Client Portal Screenshot"
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>
            <div className="mt-12 text-center text-foreground">
              <h2 className="text-3xl sm:text-5xl font-bold">
                5x Your Productivity - Reduce Labour Costs
              </h2>
              <p className="mt-4 text-xl text-muted-foreground">
                Automated with AI.
              </p>
            </div>
            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img
                  src="/client-dashboard.png"
                  alt="Client Dashboard Screenshot"
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Start Free - Scale as you like
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Start with a 14-day free trial. Cancel anytime.
            </p>
          </div>
          
          <div className="mt-16 mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              {pricingTiers.map((tier) => (
                <Card
                  key={tier.id}
                  className={`relative flex flex-col h-full ${
                    tier.highlighted
                      ? 'border-2 border-blue-500 shadow-xl'
                      : 'border border-gray-200 shadow-lg'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                    <CardDescription className="text-sm">{tier.description}</CardDescription>
                    <div className="mt-4">
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-extrabold text-foreground">
                          {tier.price === 0 ? '$0' : `$${tier.price}`}
                        </span>
                        <span className="text-muted-foreground ml-2">/month</span>
                      </div>
                      {tier.trialText && (
                        <p className="text-blue-600 text-sm font-medium mt-2">{tier.trialText}</p>
                      )}
                      {tier.price === 0 && !tier.trialText && (
                        <p className="text-blue-600 text-sm font-medium mt-2">No credit card needed</p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow">
                    <ul className="space-y-3">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <div className="p-6 pt-0">
                    <Button
                      asChild
                      className={`w-full ${
                        tier.highlighted
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : tier.price === 0
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-800 hover:bg-gray-900'
                      }`}
                    >
                      <Link href="/auth/signup">
                        {tier.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
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
            <div className="mt-10 max-w-2xl mx-auto px-4">
              <div className="flex items-center justify-center gap-3">
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
              <p className="text-center text-sm text-muted-foreground mt-3">
                Free forever. No credit card required.
              </p>
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
