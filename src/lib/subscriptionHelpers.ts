import { createClient } from '@supabase/supabase-js';
import { SubscriptionTier, SUBSCRIPTION_TIERS } from './stripe';

// Re-export tier utilities for server-side use
// Client-side code should import directly from './tierUtils' instead
export {
  isSingleClientTier,
  isMultiClientTier,
  SINGLE_CLIENT_TIERS,
  MULTI_CLIENT_TIERS,
  TIER_DISPLAY_NAMES,
  TIER_CLIENT_LIMITS,
} from './tierUtils';

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
  metadata: Record<string, unknown>;
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
  if (!subscription.user_id) {
    throw new Error('user_id is required for upsertSubscription');
  }

  // Check if subscription exists for this user
  const existingSubscription = await getUserSubscription(subscription.user_id);

  if (existingSubscription) {
    // Update existing subscription - use user_id to find the record
    // This ensures we update the correct subscription even if stripe_customer_id changed
    
    // Merge update data with existing subscription to preserve fields not being updated
    // Only update fields that are explicitly provided in subscription
    const updateData: Partial<Subscription> = {
      ...subscription,
      // Explicitly preserve usage tracking fields if not provided
      clients_used: subscription.clients_used !== undefined ? subscription.clients_used : existingSubscription.clients_used,
      posts_used_this_month: subscription.posts_used_this_month !== undefined ? subscription.posts_used_this_month : existingSubscription.posts_used_this_month,
      ai_credits_used_this_month: subscription.ai_credits_used_this_month !== undefined ? subscription.ai_credits_used_this_month : existingSubscription.ai_credits_used_this_month,
      usage_reset_date: subscription.usage_reset_date || existingSubscription.usage_reset_date,
      metadata: subscription.metadata || existingSubscription.metadata,
    };

    // If stripe_customer_id is changing, we need to handle the UNIQUE constraint
    // First check if the new customer ID already exists for a different user
    if (subscription.stripe_customer_id && subscription.stripe_customer_id !== existingSubscription.stripe_customer_id) {
      const { data: conflictCheck, error: conflictError } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', subscription.stripe_customer_id)
        .neq('user_id', subscription.user_id)
        .maybeSingle();

      // Only throw error if conflict actually exists (not if it's just "not found")
      if (conflictCheck) {
        throw new Error(`Stripe customer ID ${subscription.stripe_customer_id} is already associated with another user`);
      }
      
      // If there's an error other than "not found", log it but don't fail
      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Error checking for customer ID conflict:', conflictError);
        // Continue with update anyway - database constraint will catch it if there's a real conflict
      }
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('user_id', subscription.user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
    return data;
  } else {
    // Insert new subscription
    // Ensure required fields are set
    if (!subscription.stripe_customer_id) {
      throw new Error('stripe_customer_id is required when creating a new subscription');
    }

    const insertData: Partial<Subscription> = {
      ...subscription,
      // Set defaults if not provided
      subscription_tier: subscription.subscription_tier ?? 'trial',
      subscription_status: subscription.subscription_status ?? 'active',
      max_clients: subscription.max_clients ?? 1,
      max_posts_per_month: subscription.max_posts_per_month ?? 0,
      max_ai_credits_per_month: subscription.max_ai_credits_per_month ?? 10,
      clients_used: subscription.clients_used ?? 0,
      posts_used_this_month: subscription.posts_used_this_month ?? 0,
      ai_credits_used_this_month: subscription.ai_credits_used_this_month ?? 0,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      metadata: subscription.metadata ?? {},
    };

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting subscription:', error);
      throw error;
    }
    return data;
  }
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

// Add purchased credits to subscription
// This increases max_ai_credits_per_month (not ai_credits_used_this_month)
export async function addPurchasedCredits(
  userId: string,
  credits: number
) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw new Error('No subscription found for user');
  }

  const newMaxCredits = subscription.max_ai_credits_per_month === -1 
    ? -1 // Unlimited stays unlimited
    : subscription.max_ai_credits_per_month + credits;

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      max_ai_credits_per_month: newMaxCredits,
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

