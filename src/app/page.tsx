"use client";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { useState, useEffect, Fragment, useMemo } from "react";
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
import { Oswald, Poppins } from "next/font/google";
import { isSingleClientTier } from "../lib/tierUtils";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
}

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["700"],
});

const pricingTiers = [
  {
    name: 'Free',
    id: 'freemium',
    price: 0,
    description: 'Available to everyone',
    features: [
      '1 Business profile',
      'AI copy generation',
      'AI content ideas',
      'Content calendar',
      '10 AI Credits per month',
    ],
    highlighted: false,
  },
  {
    name: 'In-House',
    id: 'starter',
    price: 50,
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
    name: 'Freelancer',
    id: 'professional',
    price: 89,
    description: 'For freelancers and agencies',
    trialText: '14-day free trial',
    features: [
      'Everything in In-House',
      '5 Business profiles',
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
      'Everything in Freelancer',
      'Unlimited Client profiles',
      'Unlimited Scheduled posts',
      'White-Label Branding',
      '2,000 AI Credits per month',
    ],
    highlighted: false,
  },
];

const comparisonSections = [
  {
    title: 'Core Features',
    rows: [
      {
        label: 'Client Profiles',
        values: ['1', '1', '5', 'Unlimited'],
      },
      {
        label: 'AI Copy Generation',
        values: ['check', 'check', 'check', 'check'],
      },
      {
        label: 'AI Content Ideas',
        values: ['check', 'check', 'check', 'check'],
      },
      {
        label: 'Content Calendar',
        values: ['check', 'check', 'check', 'check'],
      },
      {
        label: 'AI Credits per Month',
        values: ['10', '100', '500', '2,000'],
      },
    ],
  },
  {
    title: 'Scheduling & Publishing',
    rows: [
      {
        label: 'Social Media Scheduling',
        values: ['cross', 'check', 'check', 'check'],
      },
      {
        label: 'Scheduled Posts per Month',
        values: ['dash', '30', '150', 'Unlimited'],
      },
    ],
  },
  {
    title: 'Support & Branding',
    rows: [
      {
        label: 'Email Support',
        values: ['cross', 'check', 'check', 'check'],
      },
      {
        label: 'White-Label Branding',
        values: ['cross', 'cross', 'cross', 'check'],
      },
      {
        label: 'Dedicated Account Manager',
        values: ['cross', 'cross', 'cross', 'check'],
      },
    ],
  },
];

export default function Home() {
  const { user, signOut, getAccessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  // Compute the correct dashboard URL based on subscription tier
  // Single-client tiers (Free, In-House) go directly to their client dashboard
  // Multi-client tiers (Freelancer, Agency) go to the home dashboard
  const dashboardUrl = useMemo(() => {
    if (!user) return '/dashboard';
    
    // If single-client tier and has exactly 1 client, go directly to client dashboard
    if (isSingleClientTier(subscriptionTier) && clients.length === 1) {
      return `/dashboard/client/${clients[0].id}`;
    }
    
    // Otherwise, go to home dashboard (which will handle any further redirects)
    return '/dashboard';
  }, [user, subscriptionTier, clients]);

  const planColumns = pricingTiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    description: tier.description,
    highlighted: tier.highlighted,
    buttonText: tier.price === 0 ? 'Get Started Free' : 'Start Free Trial',
  }));

  const renderComparisonValue = (value: string) => {
    if (value === 'check') {
      return <Check className="mx-auto h-5 w-5 text-emerald-500" />;
    }
    if (value === 'cross') {
      return <X className="mx-auto h-5 w-5 text-rose-500" />;
    }
    if (value === 'dash') {
      return <span className="text-gray-400">—</span>;
    }

    return <span className="text-gray-700">{value}</span>;
  };

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

  // Fetch subscription tier and clients for tier-based dashboard routing
  useEffect(() => {
    async function fetchSubscriptionAndClients() {
      if (!user) {
        setSubscriptionTier(null);
        setClients([]);
        return;
      }

      try {
        // Fetch subscription tier
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('subscription_tier')
          .eq('user_id', user.id)
          .single();

        if (subError && subError.code !== 'PGRST116') {
          console.error('Error fetching subscription:', subError);
        }
        setSubscriptionTier(subData?.subscription_tier || 'freemium');

        // Fetch clients for single-client tier routing
        const token = getAccessToken();
        if (token) {
          const response = await fetch('/api/clients', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setClients(data.clients || []);
          }
        }
      } catch (err) {
        console.error('Error fetching subscription/clients:', err);
        setSubscriptionTier('freemium');
      }
    }

    fetchSubscriptionAndClients();
  }, [user?.id, getAccessToken]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <img 
                  src="/cm-logo.png" 
                  alt="CM Logo" 
                  className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="hidden md:block h-6 w-auto ml-4 object-contain rounded-[4px]"
              />
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    Welcome, {profile?.username || profile?.full_name || user.email}
                  </span>
                  <Link href={dashboardUrl}>
                    <Button size="sm">Dashboard</Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
                    onClick={async () => {
                      await signOut();
                      router.push('/');
                    }}
                  >
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
                  href="/features" 
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="/pricing" 
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <Link 
                  href="/contact" 
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                
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
                        <Link href={dashboardUrl} onClick={() => setMobileMenuOpen(false)}>
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
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center justify-center">
                <img 
                  src="/content-manager-logo.png" 
                  alt="Content Manager" 
                  className="h-[18rem] sm:h-[30rem] w-auto inline-block align-middle -my-32 sm:-my-56 -ml-4 -mr-4 sm:-ml-7 sm:-mr-6"
                />
              </div>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
              Your AI pilot for social media managers
              <br />
              <span className={`${poppins.className} font-bold bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent pr-1`}>
                work 3x faster
              </span>
            </h1>
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
                      // Use computed dashboard URL based on tier
                      router.push(dashboardUrl);
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
              <p className="font-['Poppins'] font-medium text-foreground whitespace-nowrap text-3xl sm:text-5xl mt-8">
                Plan, Create, Schedule
              </p>
            </div>
          </div>
          
          {/* Hero Image/Illustration */}
          <div className="mt-12 mx-auto max-w-5xl">
            <div className="flex flex-col items-center mb-6">
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
                3x Your Productivity - Save Labour Costs
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

          {/* Compare Plans Section */}
          <div className="mt-20">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900">Compare Plans</h2>
              <p className="mt-2 text-gray-600">
                See what's included with each tier so you can choose the right fit for your team.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="min-w-[200px] px-6 py-6 text-left text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Features
                      </th>
                      {planColumns.map((plan) => (
                        <th
                          key={plan.id}
                          className={`px-6 py-6 text-center text-sm font-semibold uppercase tracking-wide ${
                            plan.highlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-500'
                          }`}
                        >
                          <div className="mx-auto flex max-w-[200px] flex-col items-center gap-2">
                            {plan.highlighted && (
                              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                                Most Popular
                              </span>
                            )}
                            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                            <p className="text-3xl font-extrabold text-gray-900">
                              {plan.price === 0 ? '$0' : `$${plan.price}`}
                              <span className="text-base font-medium text-gray-500">/month</span>
                            </p>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comparisonSections.map((section) => (
                      <Fragment key={section.title}>
                        <tr className="bg-gray-50">
                          <td
                            colSpan={planColumns.length + 1}
                            className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-600"
                          >
                            {section.title}
                          </td>
                        </tr>
                        {section.rows.map((row) => (
                          <tr key={row.label} className="bg-white">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.label}</td>
                            {row.values.map((value, index) => {
                              const plan = planColumns[index];
                              return (
                                <td
                                  key={`${row.label}-${plan.id}`}
                                  className={`px-6 py-4 text-center text-sm ${
                                    plan.highlighted ? 'bg-blue-50 font-semibold text-gray-900' : 'text-gray-600'
                                  }`}
                                >
                                  {renderComparisonValue(value)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="px-6 py-6"></td>
                      {planColumns.map((plan) => (
                        <td
                          key={`${plan.id}-cta`}
                          className={`px-6 py-6 text-center ${
                            plan.highlighted ? 'bg-blue-50' : 'bg-gray-50'
                          }`}
                        >
                          <Button
                            asChild
                            className={`w-full py-3 ${
                              plan.highlighted
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : plan.price === 0
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-gray-800 hover:bg-gray-900'
                            }`}
                          >
                            <Link href="/auth/signup">
                              {plan.buttonText}
                            </Link>
                          </Button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>Start Free. Cancel anytime.</p>
              <p className="mt-2">
                Questions?{' '}
                <Link href="/contact" className="text-blue-600 hover:underline">
                  Contact our team
                </Link>
              </p>
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
                      // Use computed dashboard URL based on tier
                      router.push(dashboardUrl);
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
              <a href="https://www.oneonethree.co.nz/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40">
            <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
              <p className="text-sm text-muted-foreground text-center md:text-left">
              © 2024 Content Manager. All rights reserved.
            </p>
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/oot-product-silver-1.png"
                  alt="OOT Digital Product"
                  className="h-16 w-auto object-contain rounded-[4px]"
                />
                <a 
                  href="https://www.oneonethree.co.nz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base text-muted-foreground hover:text-foreground transition-colors"
                >
                  www.oneonethree.co.nz
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
