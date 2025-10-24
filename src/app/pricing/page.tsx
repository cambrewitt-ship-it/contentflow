'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const tiers = [
  {
    name: 'Freemium',
    id: 'freemium',
    price: 0,
    description: 'Perfect for trying out the platform',
    priceId: null,
    features: [
      '1 Client Account',
      '10 AI Credits per month',
      'No social media posting',
      'Basic Analytics',
      'Community Support',
    ],
    highlighted: false,
  },
  {
    name: 'Starter',
    id: 'starter',
    price: 35,
    description: 'Perfect for individuals getting started',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    features: [
      '1 Client Account',
      '30 Posts per month',
      '100 AI Credits per month',
      'Basic Analytics',
      'Email Support',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    id: 'professional',
    price: 79,
    description: 'For growing businesses and agencies',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    features: [
      '5 Client Accounts',
      '150 Posts per month',
      '500 AI Credits per month',
      'Advanced Analytics',
      'Priority Email Support',
      'Custom Branding',
    ],
    highlighted: true,
  },
  {
    name: 'Agency',
    id: 'agency',
    price: 199,
    description: 'For established agencies with multiple clients',
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID!,
    features: [
      'Unlimited Client Accounts',
      'Unlimited Posts per month',
      '2000 AI Credits per month',
      'Advanced Analytics',
      'White-Label Options',
      'Priority Phone & Email Support',
      'Dedicated Account Manager',
    ],
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
              className={`relative flex flex-col p-8 ${
                tier.highlighted
                  ? 'border-2 border-blue-500 shadow-xl scale-105'
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
                    {tier.price === 0 ? 'Free' : `$${tier.price}`}
                  </span>
                  {tier.price > 0 && <span className="text-gray-600 ml-2">/month</span>}
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

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

