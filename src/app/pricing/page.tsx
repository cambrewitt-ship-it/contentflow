'use client';

import { Fragment, useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { FacebookIcon, LinkedInIcon } from '@/components/social-icons';

const tiers = [
  {
    name: 'In-House',
    id: 'starter',
    price: 50,
    description: 'For marketing managers',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    longDescription: 'Perfect for marketing managers. Includes higher capacity and the ability to schedule posts.',
    trialText: '14-day free trial',
    features: [
      '1 Business profile — Store brand info, voice, and tone',
      'AI copy generation — Upload images, get social & email copy instantly',
      'AI content ideas — Seasonal and profile-specific suggestions',
      'Content calendar — Plan and organize posts visually',
      '30 Posts per month — Schedule and automate social content',
      'Email Support',
      '100 AI Credits per month',
    ],
    bestFor: 'Freelancers, solopreneurs, and individuals managing one brand.',
    buttonText: 'Start 14-Day Free Trial',
    highlighted: false,
  },
  {
    name: 'Freelancer',
    id: 'professional',
    price: 89,
    description: 'For freelancers and agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    longDescription: 'Everything in In-House, plus capacity for multiple clients, advanced analytics, and custom branding.',
    trialText: '14-day free trial',
    features: [
      'Everything in In-House',
      '5 Business profiles — Manage multiple brands',
      '150 Scheduled posts per month',
      '500 AI Credits per month',
    ],
    bestFor: 'Growing agencies, consultants, and multi-client managers.',
    buttonText: 'Start 14-Day Free Trial',
    highlighted: true,
  },
  {
    name: 'Agency',
    id: 'agency',
    price: 199,
    description: 'For larger marketing agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID!,
    longDescription: 'Everything in Freelancer, plus unlimited business profiles, unlimited posts, and dedicated support.',
    trialText: '14-day free trial',
    features: [
      'Everything in Freelancer',
      'Unlimited Business profiles',
      'Unlimited Scheduled posts',
      'White-Label Branding',
      'Dedicated Account Manager',
      '2,000 AI Credits per month',
    ],
    bestFor: 'Established agencies managing 10+ business profiles with high-volume content needs.',
    buttonText: 'Start 14-Day Free Trial',
    highlighted: false,
  },
];

const comparisonSections = [
  {
    title: 'Core Features',
    rows: [
      {
        label: 'Client Profiles',
        values: ['1', '5', 'Unlimited'],
      },
      {
        label: 'AI Copy Generation',
        values: ['check', 'check', 'check'],
      },
      {
        label: 'AI Content Ideas',
        values: ['check', 'check', 'check'],
      },
      {
        label: 'Content Calendar',
        values: ['check', 'check', 'check'],
      },
      {
        label: 'AI Credits per Month',
        values: ['100', '500', '2,000'],
      },
    ],
  },
  {
    title: 'Scheduling & Publishing',
    rows: [
      {
        label: 'Social Media Scheduling',
        values: ['check', 'check', 'check'],
      },
      {
        label: 'Scheduled Posts per Month',
        values: ['30', '150', 'Unlimited'],
      },
    ],
  },
  {
    title: 'Support & Branding',
    rows: [
      {
        label: 'Email Support',
        values: ['check', 'check', 'check'],
      },
      {
        label: 'White-Label Branding',
        values: ['cross', 'cross', 'check'],
      },
      {
        label: 'Dedicated Account Manager',
        values: ['cross', 'cross', 'check'],
      },
    ],
  },
];

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut, getAccessToken } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const processedPriceIdRef = useRef<string | null>(null);

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

        setProfile(data || null);
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    }

    fetchProfile();
  }, [user?.id]);

  const handleSubscribe = async (priceId: string | null | undefined, tierId: string) => {
    try {
      setLoadingTier(tierId);


      // Validate priceId for paid tiers
      if (!priceId || (typeof priceId === 'string' && priceId.trim() === '')) {
        console.error('Price ID is missing for tier:', tierId, 'priceId:', priceId);
        alert('This plan is not properly configured. Please contact support or try again later.');
        setLoadingTier(null);
        return;
      }

      // Get access token
      const accessToken = getAccessToken();
      if (!accessToken) {
        // Not authenticated, redirect to signup with priceId to start checkout after signup
        router.push(`/auth/signup?priceId=${encodeURIComponent(priceId)}&redirectTo=/pricing`);
        return;
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
        // If unauthorized, redirect to signup/login with priceId
        if (response.status === 401) {
          if (priceId) {
            router.push(`/auth/signup?priceId=${encodeURIComponent(priceId)}&redirectTo=/pricing`);
          } else {
            router.push('/auth/signup?redirectTo=/pricing');
          }
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

  // Check if user is returning from signup/login with a priceId in URL
  useEffect(() => {
    const priceId = searchParams?.get('priceId');
    const accessToken = getAccessToken();
    
    // If user is authenticated and has priceId in URL, start checkout automatically
    // Use ref to ensure we only process each priceId once
    if (priceId && accessToken && user && !loadingTier && processedPriceIdRef.current !== priceId) {
      processedPriceIdRef.current = priceId;
      
      // Remove priceId from URL immediately to avoid re-triggering
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('priceId');
      window.history.replaceState({}, '', newUrl.toString());
      
      // Start checkout
      handleSubscribe(priceId, 'auto');
    }
    // Note: We intentionally don't include handleSubscribe in deps to avoid re-triggers
    // The function is stable enough for this use case
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, searchParams]);

  const planColumns = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    description: tier.description,
    highlighted: tier.highlighted,
    priceId: tier.priceId,
    buttonText: (tier as any).buttonText || 'Start 14-Day Free Trial',
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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <img src="/cm-logo.png" alt="CM Logo" className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
              </Link>
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="hidden h-6 w-auto rounded-[4px] object-contain md:ml-4 md:block"
              />
            </div>

            <div className="hidden items-center space-x-8 md:flex">
              <Link href="/features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Features
              </Link>
              <Link
                href="/#pricing"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Contact
              </Link>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    Welcome, {profile?.username || profile?.full_name || user.email}
                  </span>
                  <Link href="/dashboard">
                    <Button size="sm">Dashboard</Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm">Start 14-Day Free Trial</Button>
                  </Link>
                </div>
              )}
            </div>

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

          {mobileMenuOpen && (
            <div className="supports-[backdrop-filter]:bg-background/60 border-t border-border/40 bg-background/95 backdrop-blur md:hidden">
              <div className="space-y-1 px-2 pb-3 pt-2">
                <Link
                  href="/features"
                  className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="/#pricing"
                  className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/contact"
                  className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>

                <div className="border-t border-border/40 pb-3 pt-4">
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                          >
                            Sign In
                          </Button>
                        </Link>
                      </div>
                      <div className="px-3">
                        <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                          <Button size="sm" className="w-full">
                            Start 14-Day Free Trial
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

      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </div>

          <div className="mb-12 text-center">
            <h1 className="mb-6 text-5xl font-black text-gray-900 sm:text-6xl">Start Your 14-Day Free Trial</h1>
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-xl text-gray-600">14-day free trial. Cancel anytime.</p>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 md:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={`relative flex h-full flex-col p-8 ${
                  tier.highlighted ? 'border-2 border-blue-500 shadow-xl' : 'border border-gray-200 shadow-lg'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 transform">
                    <span className="rounded-full bg-blue-500 px-4 py-1 text-sm font-medium text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-8">
                  <div className="mb-1 min-h-[100px]">
                    <h3 className="mb-2 text-2xl font-bold text-gray-900">{tier.name}</h3>
                    <p className="text-sm text-gray-600">{tier.description}</p>
                  </div>

                  <div className="mb-2 -mt-8 flex min-h-[120px] flex-col justify-start">
                    <div className="flex items-baseline">
                      <span className="text-5xl font-extrabold text-gray-900">
                        ${tier.price}
                      </span>
                      <span className="ml-2 text-gray-600">/month</span>
                    </div>
                  </div>

                  <div className="mb-2 min-h-[40px]">
                    {(tier as any).trialText ? (
                      <p className="text-sm font-medium text-blue-600 -mt-[50px]">{(tier as any).trialText}</p>
                    ) : (
                      <div className="invisible">Placeholder</div>
                    )}
                  </div>

                  <div className="min-h-[60px]">
                    {(tier as any).longDescription ? (
                      <p className="text-xs text-gray-600">{(tier as any).longDescription}</p>
                    ) : (
                      <div className="invisible">Placeholder</div>
                    )}
                  </div>
                </div>

                {tier.features && tier.features.length > 0 && (
                  <>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">What's included:</h4>
                    <ul className="mb-8 space-y-4">
                      {tier.features.map((feature, index) => {
                        const parts = feature.split('—');
                        const mainText = parts[0].trim();
                        const subText = parts.length > 1 ? parts.slice(1).join('—').trim() : '';

                        return (
                          <li key={index} className="flex items-start">
                            <Check className="mr-3 h-5 w-5 flex-shrink-0 text-green-500" />
                            <div>
                              <span className="text-[20px] font-black text-black">{mainText}</span>
                              {subText && <div className="text-[16px] font-normal text-gray-500">{subText}</div>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                <div className="mb-6"></div>

                <div className="flex-grow"></div>

                <Button
                  onClick={() => {
                    if (!tier.priceId && tier.price > 0) {
                      alert('This plan is not properly configured. Please contact support.');
                      return;
                    }
                    handleSubscribe(tier.priceId, tier.id);
                  }}
                  disabled={loadingTier !== null || (!tier.priceId && tier.price > 0)}
                  className={`w-full py-3 ${
                    tier.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-800 hover:bg-gray-900'
                  }`}
                >
                  {loadingTier === tier.id ? (
                    <span className="flex items-center justify-center">
                      <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
                  ) : (
                    'Start 14 Days Free'
                  )}
                </Button>
              </Card>
            ))}
          </div>

          <div className="mt-20">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900">Compare Plans</h2>
              <p className="mt-2 text-gray-600">
                See what’s included with each tier so you can choose the right fit for your team.
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
                              ${plan.price}
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
                            onClick={() => {
                              if (!plan.priceId && plan.price > 0) {
                                alert('This plan is not properly configured. Please contact support.');
                                return;
                              }
                              handleSubscribe(plan.priceId, plan.id);
                            }}
                            disabled={loadingTier !== null || (!plan.priceId && plan.price > 0)}
                            className={`w-full py-3 ${
                              plan.highlighted
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-gray-800 hover:bg-gray-900'
                            }`}
                          >
                            {loadingTier === plan.id ? (
                              <span className="flex items-center justify-center">
                                <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
                            ) : (
                              plan.buttonText
                            )}
                          </Button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>14-day free trial. Cancel anytime.</p>
              <p className="mt-2">
                Questions?{' '}
                <Link href="/contact" className="text-blue-600 hover:underline">
                  Contact our team
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Left Section - Content Manager */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-lg font-bold text-foreground mb-4">Content Manager</h3>
              <div className="flex flex-col space-y-2">
                <a href="https://www.oneonethree.co.nz/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </a>
                <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </a>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </div>
            </div>

            {/* Middle Section - OneOneThree Digital */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-lg font-bold text-foreground mb-4">OneOneThree Digital</h3>
              <div className="flex flex-col space-y-2">
                <a href="https://www.oneonethree.co.nz/home" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Home
                </a>
                <a href="https://www.oneonethree.co.nz/about" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </a>
                <a href="https://www.oneonethree.co.nz/our-services" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Services
                </a>
                <a href="https://www.oneonethree.co.nz/products" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Other Products
                </a>
              </div>
            </div>

            {/* Socials Section */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-lg font-bold text-foreground mb-4">Socials</h3>
              <div className="flex flex-col space-y-3">
                <a 
                  href="https://www.facebook.com/profile.php?id=61574924115662" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FacebookIcon size={20} />
                  <span>Facebook</span>
                </a>
                <a 
                  href="https://nz.linkedin.com/company/oneonethreedigital" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LinkedInIcon size={20} />
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>

            {/* Right Section - Logo */}
            <div className="flex flex-col items-center md:items-end justify-center gap-2">
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="h-16 w-auto object-contain rounded-[4px]"
              />
              <p className="text-sm text-muted-foreground text-center md:text-right">
                See more at{" "}
                <a
                  href="https://www.oneonethree.co.nz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline transition-colors"
                >
                  oneonethree.co.nz
                </a>
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border/40">
            <p className="text-sm text-muted-foreground text-center">
              © 2025 OneOneThree Digital. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading pricing...</p>
        </div>
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  );
}
