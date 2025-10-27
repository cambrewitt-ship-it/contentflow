'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

const tiers = [
  {
    name: 'Free',
    id: 'freemium',
    price: 0,
    description: 'Available to everyone',
    priceId: null,
    longDescription: 'Free forever. Try the platform, explore AI-powered content tools, and manage your first client.',
    features: [
      '1 Client profile — Store brand info, voice, and tone',
      'AI copy generation — Upload images, get social & email copy instantly',
      'AI content ideas — Seasonal and client-specific suggestions',
      'Content calendar — Plan and organize posts visually',
      '10 AI Credits per month',
    ],
    limitations: [
      'No social media scheduling',
      'Limited AI generation capacity',
    ],
    bestFor: 'Students, casual users, or anyone curious about AI-assisted social media management.',
    buttonText: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Starter',
    id: 'starter',
    price: 35,
    description: 'For marketing managers',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    longDescription: 'Everything in Free, plus higher capacity and the ability to schedule posts.',
    trialText: '14-day free trial',
    features: [
      'Everything in Free',
      '30 Posts per month — Schedule and automate social content',
      'Email Support',
      '100 AI Credits per month — 10x more generation power',
    ],
    bestFor: 'Freelancers, solopreneurs, and individuals managing one brand.',
    buttonText: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    id: 'professional',
    price: 79,
    description: 'For freelancers and agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    longDescription: 'Everything in Starter, plus capacity for multiple clients, advanced analytics, and custom branding.',
    trialText: '14-day free trial',
    features: [
      'Everything in Starter',
      '5 Client profiles — Manage multiple brands',
      '150 Scheduled posts per month',
      '500 AI Credits per month',
    ],
    bestFor: 'Growing agencies, consultants, and multi-client managers.',
    buttonText: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Agency',
    id: 'agency',
    price: 199,
    description: 'For larger marketing agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID!,
    longDescription: 'Everything in Professional, plus unlimited clients, unlimited posts, and dedicated support.',
    trialText: '14-day free trial',
    features: [
      'Everything in Professional',
      'Unlimited Client profiles',
      'Unlimited Scheduled posts',
      'White-Label Branding',
      'Dedicated Account Manager',
      '2,000 AI Credits per month',
    ],
    bestFor: 'Established agencies managing 10+ clients with high-volume content needs.',
    buttonText: 'Start Free Trial',
    highlighted: false,
  },
];

export default function Home() {
  const router = useRouter();
  const { getAccessToken, user, signOut } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      
      try {
        const { supabase } = await import('@/lib/supabaseClient');
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
  }, [user?.id]);

  const handleSubscribe = async (priceId: string | null, tierId: string) => {
    try {
      setLoadingTier(tierId);

      // Get access token
      const accessToken = getAccessToken();
      if (!accessToken) {
        // Not authenticated, redirect to login
        router.push('/auth/login?redirect=/pricing');
        return;
      }

      // Handle freemium tier (redirect to login)
      if (tierId === 'freemium') {
        router.push('/auth/login?redirect=/pricing');
        return;
      }

      // Handle paid tiers
      if (!priceId) {
        throw new Error('Price ID is required for paid tiers');
      }

      // Call checkout API
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If unauthorized, redirect to login
        if (response.status === 401) {
          router.push('/auth/login?redirect=/pricing');
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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

      {/* Pricing Content */}
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600">
              Start with a 14-day free trial. Cancel anytime.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto items-stretch">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={`relative flex flex-col p-8 h-full ${
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

                {/* Structured header section with consistent heights */}
                <div className="mb-8">
                  {/* Title section - min-height 80px */}
                  <div className="min-h-[100px] mb-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {tier.name}
                    </h3>
                    <p className="text-gray-600 text-sm">{tier.description}</p>
                  </div>

                  {/* Price section - min-height 120px */}
                  <div className="min-h-[120px] flex flex-col justify-start mb-2 -mt-8">
                    <div className="flex items-baseline">
                      <span className="text-5xl font-extrabold text-gray-900">
                        {tier.price === 0 ? '$0' : `$${tier.price}`}
                      </span>
                      <span className="text-gray-600 ml-2">/month</span>
                    </div>
                  </div>

                  {/* Trial badge section - min-height 40px */}
                  <div className="min-h-[40px] mb-2">
                    {(tier as any).trialText ? (
                      <p className="text-blue-600 text-sm font-medium -mt-[50px]">{(tier as any).trialText}</p>
                    ) : tier.price === 0 ? (
                      <p className="text-blue-600 text-sm font-medium -mt-[50px]">No credit card needed</p>
                    ) : (
                      <div className="invisible">Placeholder</div>
                    )}
                  </div>

                  {/* Description section - min-height 60px */}
                  <div className="min-h-[60px]">
                    {(tier as any).longDescription ? (
                      <p className="text-gray-600 text-xs">{(tier as any).longDescription}</p>
                    ) : (
                      <div className="invisible">Placeholder</div>
                    )}
                  </div>
                </div>

                {/* Features */}
                {tier.features && tier.features.length > 0 && (
                  <>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">What's included:</h4>
                    <ul className="space-y-4 mb-8">
                      {tier.features.map((feature, index) => {
                        const parts = feature.split('—');
                        const mainText = parts[0].trim();
                        const subText = parts.length > 1 ? parts.slice(1).join('—').trim() : '';
                        
                        return (
                          <li key={index} className="flex items-start">
                            <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[20px] font-black text-black">{mainText}</span>
                              {subText && (
                                <div className="text-[16px] font-normal text-gray-500">{subText}</div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {/* Limitations (only for freemium) */}
                {(tier as any).limitations && tier.id === 'freemium' ? (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Limitations:</h4>
                    <ul className="space-y-2">
                      {(tier as any).limitations.map((limitation: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-red-500 mr-2">•</span>
                          <span className="text-gray-600 text-sm">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-6"></div>
                )}

                {/* Spacer to push button to bottom */}
                <div className="flex-grow"></div>

                <Button
                  onClick={() => handleSubscribe(tier.priceId, tier.id)}
                  disabled={loadingTier !== null}
                  className={`w-full py-3 ${
                    tier.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : tier.price === 0
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-800 hover:bg-gray-900'
                  }`}
                >
                  {loadingTier === tier.id ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin h-5 w-5 mr-2"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading...
                    </span>
                  ) : (tier as any).buttonText ? (
                    (tier as any).buttonText
                  ) : tier.price === 0 ? (
                    'Get Started Free'
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
              </Card>
            ))}
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-16 text-center">
            <p className="text-gray-600 mb-4">
              All plans include a 14-day free trial. No credit card required.
            </p>
            <p className="text-gray-600">
              Questions?{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                Contact our sales team
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
