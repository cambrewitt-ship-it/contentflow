'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

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
    name: 'In-House',
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
    name: 'Freelancer',
    id: 'professional',
    price: 79,
    description: 'For freelancers and agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    longDescription: 'Everything in In-House, plus capacity for multiple clients, advanced analytics, and custom branding.',
    trialText: '14-day free trial',
    features: [
      'Everything in In-House',
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
    longDescription: 'Everything in Freelancer, plus unlimited clients, unlimited posts, and dedicated support.',
    trialText: '14-day free trial',
    features: [
      'Everything in Freelancer',
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

export default function PricingPage() {
  const router = useRouter();
  const { user, signOut, getAccessToken } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const planColumns = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    description: tier.description,
    highlighted: tier.highlighted,
    priceId: tier.priceId,
    buttonText: (tier as any).buttonText || (tier.price === 0 ? 'Get Started Free' : 'Start Free Trial'),
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
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <img src="/cm-logo.png" alt="CM Logo" className="h-16 w-auto object-contain" />
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="hidden h-8 w-auto rounded-[4px] object-contain md:ml-4 md:block"
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
                    <Button size="sm">Get Started FREE</Button>
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
            <h1 className="mb-6 text-5xl font-black text-gray-900 sm:text-6xl">Start Free &amp; Scale</h1>
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-xl text-gray-600">Start with a 14-day free trial. Cancel anytime.</p>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 md:grid-cols-4">
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
                        {tier.price === 0 ? '$0' : `$${tier.price}`}
                      </span>
                      <span className="ml-2 text-gray-600">/month</span>
                    </div>
                  </div>

                  <div className="mb-2 min-h-[40px]">
                    {(tier as any).trialText ? (
                      <p className="text-sm font-medium text-blue-600 -mt-[50px]">{(tier as any).trialText}</p>
                    ) : tier.price === 0 ? (
                      <p className="text-sm font-medium text-blue-600 -mt-[50px]">No credit card needed</p>
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

                {(tier as any).limitations && tier.id === 'freemium' ? (
                  <div className="mb-6">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">Limitations:</h4>
                    <ul className="space-y-2">
                      {(tier as any).limitations.map((limitation: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="mr-2 text-red-500">•</span>
                          <span className="text-sm text-gray-600">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-6"></div>
                )}

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
                  ) : tier.price === 0 ? (
                    'Get Started Free'
                  ) : (
                    'Subscribe Now'
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
                            onClick={() => handleSubscribe(plan.priceId, plan.id)}
                            disabled={loadingTier !== null}
                            className={`w-full py-3 ${
                              plan.highlighted
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : plan.price === 0
                                ? 'bg-green-600 hover:bg-green-700'
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
              <p>All paid plans start with a 14-day free trial. Cancel anytime.</p>
              <p className="mt-2">
                Questions?{' '}
                <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                  Contact our team
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-foreground">Content Manager</h3>
            </div>
            <div className="mt-4 flex items-center space-x-6 md:mt-0">
              <a
                href="https://www.oneonethree.co.nz/privacy-policy"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </a>
              <a href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Support
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-border/40 pt-8">
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <p className="text-center text-sm text-muted-foreground md:text-left">
                © 2025 OneOneThree Digital. All rights reserved.
              </p>
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="h-16 w-auto rounded-[4px] object-contain"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

