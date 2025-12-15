import Stripe from 'stripe';

// ===== STRIPE CONFIGURATION VALIDATION =====
// Validate Stripe configuration on startup to fail fast if misconfigured

// 1. Check if STRIPE_SECRET_KEY exists
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    '❌ STRIPE_SECRET_KEY is not set in environment variables. ' +
    'Please add STRIPE_SECRET_KEY to your .env file. ' +
    'Get your key from: https://dashboard.stripe.com/apikeys'
  );
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// 2. Validate key format - must start with 'sk_'
if (!stripeSecretKey.startsWith('sk_')) {
  throw new Error(
    `❌ Invalid STRIPE_SECRET_KEY format. ` +
    `Stripe secret keys must start with 'sk_' but got: ${stripeSecretKey.substring(0, 10)}... ` +
    `Please check your environment variables.`
  );
}

// 3. In production, ensure we're not using a test key
if (process.env.NODE_ENV === 'production' && stripeSecretKey.startsWith('sk_test_')) {
  throw new Error(
    '❌ SECURITY ERROR: Using Stripe TEST key in PRODUCTION environment! ' +
    'You must use a live Stripe key (starts with sk_live_) in production. ' +
    'Get your live key from: https://dashboard.stripe.com/apikeys ' +
    'Current key starts with: sk_test_...'
  );
}

// Initialize Stripe with the validated secret key
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
});

// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
  freemium: {
    name: 'Freemium',
    priceId: null, // No Stripe price ID for free tier
    price: 0,
    maxClients: 1,
    maxPostsPerMonth: 0, // No posting to social media
    maxAICreditsPerMonth: 10,
    features: [
      '1 Business Profile',
      '10 AI Credits per month',
      'No social media posting',
      'Basic Analytics',
      'Community Support',
    ],
  },
  starter: {
    name: 'In-House',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    price: 35,
    maxClients: 1,
    maxPostsPerMonth: 30,
    maxAICreditsPerMonth: 100,
    features: [
      '1 Business Profile',
      '30 Posts per month',
      '100 AI Credits per month',
      'Basic Analytics',
      'Email Support',
    ],
  },
  professional: {
    name: 'Freelancer',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID!,
    price: 79,
    maxClients: 5,
    maxPostsPerMonth: 150,
    maxAICreditsPerMonth: 500,
    features: [
      '5 Business Profiles',
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
      'Unlimited Business Profiles',
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

// Verify webhook signature with enhanced security
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  if (!signature) {
    throw new Error('No webhook signature provided');
  }

  if (!payload) {
    throw new Error('No webhook payload provided');
  }

  try {
    // Construct and verify the event
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    
    // Additional security checks
    validateWebhookEvent(event);
    
    return event;
  } catch (error) {
    if (error instanceof Error) {
      // Log the error for monitoring
      console.error('Webhook signature verification failed:', {
        error: error.message,
        signature: signature.substring(0, 20) + '...',
        payloadLength: typeof payload === 'string' ? payload.length : payload.length,
        timestamp: new Date().toISOString()
      });
      
      // Re-throw with sanitized error message
      throw new Error('Invalid webhook signature');
    }
    throw error;
  }
}

// Validate webhook event for additional security
function validateWebhookEvent(event: Stripe.Event): void {
  // Check event age (prevent replay attacks)
  const eventAge = Date.now() - (event.created * 1000);
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  if (eventAge > maxAge) {
    throw new Error('Webhook event is too old');
  }

  // Validate event structure
  if (!event.id || !event.type || !event.created) {
    throw new Error('Invalid webhook event structure');
  }

  // Check for suspicious event types
  const suspiciousTypes = [
    'account.updated',
    'capability.updated',
    'person.updated'
  ];
  
  if (suspiciousTypes.includes(event.type)) {
    console.warn('Received potentially suspicious webhook event:', {
      type: event.type,
      id: event.id,
      timestamp: new Date().toISOString()
    });
  }

  // Validate event data exists
  if (!event.data || !event.data.object) {
    throw new Error('Webhook event missing data');
  }
}

// Enhanced webhook signature verification with timestamp validation
export function verifyWebhookSignatureWithTimestamp(
  payload: string | Buffer,
  signature: string,
  tolerance: number = 300 // 5 minutes default tolerance
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    // Parse signature header to extract timestamp
    const elements = signature.split(',');
    const timestampElement = elements.find(element => element.startsWith('t='));
    
    if (timestampElement) {
      const timestamp = parseInt(timestampElement.split('=')[1]);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check timestamp tolerance
      if (Math.abs(currentTime - timestamp) > tolerance) {
        throw new Error('Webhook timestamp too old');
      }
    }

    // Verify signature
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    
    // Additional validation
    validateWebhookEvent(event);
    
    return event;
  } catch (error) {
    console.error('Webhook verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

