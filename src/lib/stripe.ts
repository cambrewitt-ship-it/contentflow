import Stripe from 'stripe';

// Initialize Stripe with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
  starter: {
    name: 'Starter',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    price: 35,
    maxClients: 1,
    maxPostsPerMonth: 30,
    maxAICreditsPerMonth: 100,
    features: [
      '1 Client Account',
      '30 Posts per month',
      '100 AI Credits per month',
      'Basic Analytics',
      'Email Support',
    ],
  },
  professional: {
    name: 'Professional',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    price: 79,
    maxClients: 5,
    maxPostsPerMonth: 150,
    maxAICreditsPerMonth: 500,
    features: [
      '5 Client Accounts',
      '150 Posts per month',
      '500 AI Credits per month',
      'Advanced Analytics',
      'Priority Email Support',
      'Custom Branding',
    ],
  },
  agency: {
    name: 'Agency',
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID!,
    price: 199,
    maxClients: -1, // unlimited
    maxPostsPerMonth: -1, // unlimited
    maxAICreditsPerMonth: 2000,
    features: [
      'Unlimited Client Accounts',
      'Unlimited Posts per month',
      '2000 AI Credits per month',
      'Advanced Analytics',
      'White-Label Options',
      'Priority Phone & Email Support',
      'Dedicated Account Manager',
    ],
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

// Get tier by price ID
export function getTierByPriceId(priceId: string): SubscriptionTier | null {
  const entry = Object.entries(SUBSCRIPTION_TIERS).find(
    ([_, config]) => config.priceId === priceId
  );
  return entry ? (entry[0] as SubscriptionTier) : null;
}

// Get subscription configuration by tier
export function getSubscriptionConfig(tier: SubscriptionTier) {
  return SUBSCRIPTION_TIERS[tier];
}

// Create Stripe customer
export async function createStripeCustomer(email: string, userId: string) {
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });
  return customer;
}

// Create Stripe checkout session
export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return session;
}

// Create customer portal session
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription;
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return subscription;
}

// Resume subscription
export async function resumeSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
  return subscription;
}

// Update subscription
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    }
  );

  return updatedSubscription;
}

// List customer invoices
export async function listCustomerInvoices(customerId: string, limit = 10) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

