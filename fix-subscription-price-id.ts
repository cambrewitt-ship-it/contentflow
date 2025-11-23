/**
 * Script to fix subscriptions with missing stripe_price_id
 * This retrieves the price ID from Stripe using the subscription ID
 * 
 * Usage: Run this script via your admin/dashboard or execute the SQL/API call
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

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

async function fixSubscriptionPriceId(userId: string) {
  try {
    // Get the subscription from database
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
    }

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('No Stripe subscription ID found');
    }

    console.log(`Fetching Stripe subscription: ${subscription.stripe_subscription_id}`);

    // Retrieve subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    const priceId = stripeSubscription.items.data[0]?.price.id;
    const periodStart = stripeSubscription.current_period_start;
    const periodEnd = stripeSubscription.current_period_end;

    if (!priceId) {
      throw new Error('No price ID found in Stripe subscription');
    }

    console.log(`Found price ID: ${priceId}`);
    console.log(`Period: ${new Date(periodStart * 1000).toISOString()} to ${new Date(periodEnd * 1000).toISOString()}`);

    // Determine tier from price ID
    const getTierByPriceId = (priceId: string): string | null => {
      const tiers: Record<string, string> = {
        [process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!]: 'starter',
        [process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!]: 'professional',
        [process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID!]: 'agency',
      };
      return tiers[priceId] || null;
    };

    const tier = getTierByPriceId(priceId);
    
    if (!tier) {
      console.warn(`Could not determine tier for price ID: ${priceId}`);
    }

    // Update the subscription
    const updateData: any = {
      stripe_price_id: priceId,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      subscription_status: stripeSubscription.status,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    };

    if (tier && tier !== subscription.subscription_tier) {
      updateData.subscription_tier = tier;
      console.log(`Updating tier from ${subscription.subscription_tier} to ${tier}`);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`);
    }

    console.log('✅ Subscription updated successfully!');
    console.log('Updated data:', updated);

    return updated;
  } catch (error) {
    console.error('❌ Error fixing subscription:', error);
    throw error;
  }
}

// Run for specific user
if (require.main === module) {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: ts-node fix-subscription-price-id.ts <userId>');
    process.exit(1);
  }
  fixSubscriptionPriceId(userId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { fixSubscriptionPriceId };

