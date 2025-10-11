'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Zap,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface Subscription {
  subscription_tier: string;
  subscription_status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  max_clients: number;
  max_posts_per_month: number;
  max_ai_credits_per_month: number;
  clients_used: number;
  posts_used_this_month: number;
  ai_credits_used_this_month: number;
}

interface BillingRecord {
  id: string;
  amount_paid: number;
  currency: string;
  status: string;
  invoice_pdf: string | null;
  invoice_url: string | null;
  paid_at: string;
  period_start: string;
  period_end: string;
}

const tierNames: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  agency: 'Agency',
};

const tierPrices: Record<string, number> = {
  starter: 35,
  professional: 79,
  agency: 199,
};

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if redirected from successful checkout
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }

    fetchSubscription();
  }, [searchParams]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscription');
      const data = await response.json();

      if (response.ok) {
        setSubscription(data.subscription);
        setBillingHistory(data.billingHistory || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading(true);
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to open billing portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Active Subscription</h2>
          <p className="text-gray-600 mb-6">
            You don't have an active subscription yet. Choose a plan to get started.
          </p>
          <Button
            onClick={() => router.push('/pricing')}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            View Pricing Plans
          </Button>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-red-100 text-red-800',
      incomplete: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getUsagePercentage = (used: number, max: number) => {
    if (max === -1) return 0; // Unlimited
    return (used / max) * 100;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-800">
              Subscription successfully activated! Welcome aboard.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subscription & Billing
          </h1>
          <p className="text-gray-600">
            Manage your subscription, view usage, and billing history
          </p>
        </div>

        {/* Current Plan Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">
                  {tierNames[subscription.subscription_tier]} Plan
                </h2>
                {getStatusBadge(subscription.subscription_status)}
              </div>
              <p className="text-3xl font-bold text-blue-600">
                ${tierPrices[subscription.subscription_tier]}
                <span className="text-lg text-gray-600 font-normal">/month</span>
              </p>
            </div>
            <Button
              onClick={handleManageBilling}
              disabled={actionLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center text-gray-600 mb-2">
              <Calendar className="h-4 w-4 mr-2" />
              <span>
                {subscription.cancel_at_period_end
                  ? `Cancels on ${formatDate(subscription.current_period_end)}`
                  : `Renews on ${formatDate(subscription.current_period_end)}`}
              </span>
            </div>
            {subscription.cancel_at_period_end && (
              <p className="text-sm text-yellow-600 mt-2">
                Your subscription will be canceled at the end of the current billing
                period. You'll still have access until then.
              </p>
            )}
          </div>
        </Card>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Clients Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="font-semibold">Clients</h3>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {subscription.clients_used}
                </span>
                <span className="text-gray-600">
                  / {subscription.max_clients === -1 ? '∞' : subscription.max_clients}
                </span>
              </div>
            </div>
            {subscription.max_clients !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      getUsagePercentage(
                        subscription.clients_used,
                        subscription.max_clients
                      ),
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            )}
          </Card>

          {/* Posts Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="font-semibold">Posts This Month</h3>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {subscription.posts_used_this_month}
                </span>
                <span className="text-gray-600">
                  /{' '}
                  {subscription.max_posts_per_month === -1
                    ? '∞'
                    : subscription.max_posts_per_month}
                </span>
              </div>
            </div>
            {subscription.max_posts_per_month !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      getUsagePercentage(
                        subscription.posts_used_this_month,
                        subscription.max_posts_per_month
                      ),
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            )}
          </Card>

          {/* AI Credits Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-yellow-600 mr-2" />
                <h3 className="font-semibold">AI Credits</h3>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {subscription.ai_credits_used_this_month}
                </span>
                <span className="text-gray-600">
                  /{' '}
                  {subscription.max_ai_credits_per_month === -1
                    ? '∞'
                    : subscription.max_ai_credits_per_month}
                </span>
              </div>
            </div>
            {subscription.max_ai_credits_per_month !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      getUsagePercentage(
                        subscription.ai_credits_used_this_month,
                        subscription.max_ai_credits_per_month
                      ),
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            )}
          </Card>
        </div>

        {/* Billing History */}
        <Card className="p-6">
          <div className="flex items-center mb-6">
            <TrendingUp className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-xl font-bold">Billing History</h2>
          </div>

          {billingHistory.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No billing history yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((record) => (
                    <tr key={record.id} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        {formatDate(record.paid_at || record.period_start)}
                      </td>
                      <td className="py-3 px-4">
                        {formatCurrency(record.amount_paid, record.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            record.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {record.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {record.invoice_url && (
                          <a
                            href={record.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Upgrade Options */}
        {subscription.subscription_tier !== 'agency' && (
          <Card className="p-6 mt-6 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Need more resources?</h3>
                <p className="text-gray-600">
                  Upgrade your plan to unlock more clients, posts, and AI credits.
                </p>
              </div>
              <Button
                onClick={() => router.push('/pricing')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Plans
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

