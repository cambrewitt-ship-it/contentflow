import {
  createStripeCustomer,
  createCheckoutSession,
  getTierByPriceId,
} from '@/lib/stripe';
import { getUserSubscription, upsertSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';

const TRIAL_PERIOD_DAYS = 7;

// Tiers that granted free access without ever collecting a card. A user
// coming from one of these should not get a second free trial when they
// move to a real paid Checkout subscription.
const LEGACY_FREE_ACCESS_TIERS = ['trial', 'freemium'];

export async function startCheckoutForUser({
  userId,
  email,
  priceId,
  baseUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  baseUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const tier = getTierByPriceId(priceId);
  if (!tier) {
    return { error: 'Invalid price ID' };
  }

  const existingSubscription = await getUserSubscription(userId);
  let customerId: string;

  if (existingSubscription && existingSubscription.stripe_customer_id) {
    // Check if the customer ID is a placeholder (starts with "freemium_" or "trial_")
    // Free/trial users have placeholder IDs that don't exist in Stripe
    if (
      existingSubscription.stripe_customer_id.startsWith('freemium_') ||
      existingSubscription.stripe_customer_id.startsWith('trial_')
    ) {
      const customer = await createStripeCustomer(email, userId);
      customerId = customer.id;
      // Preserve existing subscription fields to avoid NOT NULL constraint violations
      await upsertSubscription({
        user_id: userId,
        stripe_customer_id: customerId,
        subscription_tier: existingSubscription.subscription_tier,
        subscription_status: existingSubscription.subscription_status,
        max_clients: existingSubscription.max_clients,
        max_posts_per_month: existingSubscription.max_posts_per_month,
        max_ai_credits_per_month: existingSubscription.max_ai_credits_per_month,
      });
    } else {
      customerId = existingSubscription.stripe_customer_id;
    }
  } else {
    const customer = await createStripeCustomer(email, userId);
    customerId = customer.id;
  }

  // Trial eligibility: never had a real Stripe subscription, and never had
  // free access via the legacy no-CC trial/freemium system. A missing row
  // entirely also counts as eligible (genuinely new user).
  const alreadyHadRealStripeSubscription = !!existingSubscription?.stripe_subscription_id;
  const alreadyHadLegacyFreeAccess =
    !!existingSubscription && LEGACY_FREE_ACCESS_TIERS.includes(existingSubscription.subscription_tier);
  const isTrialEligible = !alreadyHadRealStripeSubscription && !alreadyHadLegacyFreeAccess;

  try {
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId,
      successUrl: `${baseUrl}/api/stripe/callback?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
      trialPeriodDays: isTrialEligible ? TRIAL_PERIOD_DAYS : undefined,
    });

    if (!session.url) {
      return { error: 'Failed to create checkout session' };
    }

    return { url: session.url };
  } catch (error) {
    logger.error('Failed to create checkout session:', error);
    return { error: 'Failed to create checkout session' };
  }
}
