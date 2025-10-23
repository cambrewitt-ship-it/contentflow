import { createClient } from '@supabase/supabase-js';
import { SubscriptionTier, SUBSCRIPTION_TIERS } from './stripe';

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  max_clients: number;
  max_posts_per_month: number;
  max_ai_credits_per_month: number;
  clients_used: number;
  posts_used_this_month: number;
  ai_credits_used_this_month: number;
  usage_reset_date: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Get user's subscription
export async function getUserSubscription(
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No subscription found
      return null;
    }
    throw error;
  }

  return data;
}

// Create or update subscription
export async function upsertSubscription(subscription: Partial<Subscription>) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscription, {
      onConflict: 'stripe_customer_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update subscription status
export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  currentPeriodStart?: Date,
  currentPeriodEnd?: Date
) {
  const updateData: any = {
    subscription_status: status,
  };

  if (currentPeriodStart) {
    updateData.current_period_start = currentPeriodStart.toISOString();
  }

  if (currentPeriodEnd) {
    updateData.current_period_end = currentPeriodEnd.toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Check if user has active subscription
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return (
    subscription !== null &&
    (subscription.subscription_status === 'active' ||
      subscription.subscription_status === 'trialing')
  );
}

// Check subscription limit
export async function checkSubscriptionLimit(
  userId: string,
  limitType: 'clients' | 'posts' | 'ai_credits'
): Promise<{ allowed: boolean; current: number; max: number }> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return { allowed: false, current: 0, max: 0 };
  }

  let current: number;
  let max: number;

  switch (limitType) {
    case 'clients':
      current = subscription.clients_used;
      max = subscription.max_clients;
      break;
    case 'posts':
      current = subscription.posts_used_this_month;
      max = subscription.max_posts_per_month;
      break;
    case 'ai_credits':
      current = subscription.ai_credits_used_this_month;
      max = subscription.max_ai_credits_per_month;
      break;
  }

  // -1 means unlimited
  const allowed = max === -1 || current < max;

  return { allowed, current, max };
}

// Increment usage counter
export async function incrementUsage(
  userId: string,
  usageType: 'clients' | 'posts' | 'ai_credits',
  amount: number = 1
) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw new Error('No subscription found for user');
  }

  const updateData: any = {};

  switch (usageType) {
    case 'clients':
      updateData.clients_used = subscription.clients_used + amount;
      break;
    case 'posts':
      updateData.posts_used_this_month =
        subscription.posts_used_this_month + amount;
      break;
    case 'ai_credits':
      updateData.ai_credits_used_this_month =
        subscription.ai_credits_used_this_month + amount;
      break;
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Decrement usage counter (for rollback scenarios)
export async function decrementUsage(
  userId: string,
  usageType: 'clients' | 'posts' | 'ai_credits',
  amount: number = 1
) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw new Error('No subscription found for user');
  }

  const updateData: any = {};

  switch (usageType) {
    case 'clients':
      updateData.clients_used = Math.max(0, subscription.clients_used - amount);
      break;
    case 'posts':
      updateData.posts_used_this_month = Math.max(
        0,
        subscription.posts_used_this_month - amount
      );
      break;
    case 'ai_credits':
      updateData.ai_credits_used_this_month = Math.max(
        0,
        subscription.ai_credits_used_this_month - amount
      );
      break;
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Create billing history record
export async function createBillingRecord(billingData: {
  user_id: string;
  stripe_invoice_id: string;
  stripe_customer_id: string;
  amount_paid: number;
  currency: string;
  invoice_pdf?: string;
  invoice_url?: string;
  status: string;
  billing_reason?: string;
  period_start?: Date;
  period_end?: Date;
  paid_at?: Date;
}) {
  const { data, error } = await supabaseAdmin
    .from('billing_history')
    .insert({
      ...billingData,
      period_start: billingData.period_start?.toISOString(),
      period_end: billingData.period_end?.toISOString(),
      paid_at: billingData.paid_at?.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get user's billing history
export async function getBillingHistory(userId: string, limit: number = 10) {
  const { data, error } = await supabaseAdmin
    .from('billing_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// Get subscription by Stripe customer ID
export async function getSubscriptionByCustomerId(
  customerId: string
): Promise<Subscription | null> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

// Delete subscription
export async function deleteSubscription(userId: string) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

// Get tier limits
export function getTierLimits(tier: SubscriptionTier) {
  const config = SUBSCRIPTION_TIERS[tier];
  return {
    maxClients: config.maxClients,
    maxPostsPerMonth: config.maxPostsPerMonth,
    maxAICreditsPerMonth: config.maxAICreditsPerMonth,
  };
}

// Update subscription tier and limits
export async function updateSubscriptionTier(
  userId: string,
  tier: SubscriptionTier,
  priceId: string
) {
  const limits = getTierLimits(tier);

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      subscription_tier: tier,
      stripe_price_id: priceId,
      max_clients: limits.maxClients,
      max_posts_per_month: limits.maxPostsPerMonth,
      max_ai_credits_per_month: limits.maxAICreditsPerMonth,
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

