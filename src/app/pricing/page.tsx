'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

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
    description: 'For in-house marketing managers',
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
    description: 'For freelancers and social agencies',
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

export default function PricingPage() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

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

      // Handle freemium tier (no payment required)
      if (tierId === 'freemium') {
        const response = await fetch('/api/subscription/freemium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login?redirect=/pricing');
            return;
          }
          throw new Error(data.error || 'Failed to activate freemium tier');
        }

        // Redirect to dashboard
        router.push('/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
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

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {tier.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4">{tier.description}</p>
                <div className="flex items-baseline">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {tier.price === 0 ? '$0' : `$${tier.price}`}
                  </span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                {(tier as any).trialText && (
                  <p className="text-blue-600 text-sm font-medium mt-2">{(tier as any).trialText}</p>
                )}
                {(tier as any).longDescription && (
                  <p className="text-gray-600 text-xs mt-2">{(tier as any).longDescription}</p>
                )}
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

              {/* Best For */}
              {(tier as any).bestFor && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Best for:</h4>
                  <p className="text-gray-600 text-sm">{(tier as any).bestFor}</p>
                </div>
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
  );
}

