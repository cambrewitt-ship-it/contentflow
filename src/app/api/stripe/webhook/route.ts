import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyWebhookSignature, getTierByPriceId, stripe } from '@/lib/stripe';
import {
  upsertSubscription,
  updateSubscriptionStatus,
  getSubscriptionByCustomerId,
  deleteSubscription,
  createBillingRecord,
  getTierLimits,
  addPurchasedCredits,
} from '@/lib/subscriptionHelpers';
import { getCreditPackageByPriceId } from '@/lib/creditPackages';
import logger from '@/lib/logger';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

// Disable body parsing, need raw body for webhook signature verification
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialWillEnd(subscription);
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const purchaseType = session.metadata?.type;

  if (!userId || !customerId) {
    logger.error('Missing userId or customerId in session metadata');
    return;
  }

  // Handle credit purchases (one-time payments)
  if (purchaseType === 'credit_purchase') {
    const credits = session.metadata?.credits;

    if (credits) {
      try {
        await addPurchasedCredits(userId, parseInt(credits, 10));
        logger.info(`✅ Added ${credits} credits to user ${userId} from purchase`);
      } catch (error) {
        logger.error('Failed to add purchased credits:', error);
      }
    } else {
      logger.error('Credits not found in session metadata for credit purchase');
    }
    return; // Don't process subscription creation for credit purchases
  }

  // Handle subscription checkouts
  // Try to get the subscription details immediately to determine the correct tier
  let tier: string = 'starter'; // Default fallback
  let subscriptionStatus: string = 'active';
  let priceId: string | undefined;
  let currentPeriodStart: Date | undefined;
  let currentPeriodEnd: Date | undefined;
  let cancelAtPeriodEnd: boolean = false;

  if (subscriptionId) {
    try {
      // Retrieve the subscription from Stripe to get the correct tier
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      priceId = stripeSubscription.items.data[0]?.price.id;
      subscriptionStatus = stripeSubscription.status;
      cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      
      if (priceId) {
        const determinedTier = getTierByPriceId(priceId);
        if (determinedTier) {
          tier = determinedTier;
        }
      }

      // Get period dates
      const periodStart = (stripeSubscription as any).current_period_start as number;
      const periodEnd = (stripeSubscription as any).current_period_end as number;
      if (periodStart) {
        currentPeriodStart = new Date(periodStart * 1000);
      }
      if (periodEnd) {
        currentPeriodEnd = new Date(periodEnd * 1000);
      }

      logger.info(`✅ Retrieved subscription ${subscriptionId} for user ${userId}, tier: ${tier}`);
    } catch (error) {
      logger.error(`Failed to retrieve subscription ${subscriptionId} from Stripe:`, error);
      // Fall back to default tier if retrieval fails
    }
  }

  const limits = getTierLimits(tier as any);

  try {
    await upsertSubscription({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId || null,
      stripe_price_id: priceId,
      subscription_tier: tier as any,
      subscription_status: subscriptionStatus,
      current_period_start: currentPeriodStart?.toISOString(),
      current_period_end: currentPeriodEnd?.toISOString(),
      cancel_at_period_end: cancelAtPeriodEnd,
      max_clients: limits.maxClients,
      max_posts_per_month: limits.maxPostsPerMonth,
      max_ai_credits_per_month: limits.maxAICreditsPerMonth,
    });

    logger.info(`✅ Subscription created/updated for user ${userId}, tier: ${tier}, status: ${subscriptionStatus}`);
  } catch (error) {
    logger.error(`Failed to upsert subscription for user ${userId}:`, error);
    throw error; // Re-throw to be caught by outer try-catch
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  // Get the subscription record from our database
  const dbSubscription = await getSubscriptionByCustomerId(customerId);

  if (!dbSubscription) {
    logger.error('Subscription not found for customer');
    return;
  }

  const tier = getTierByPriceId(priceId) || 'starter';
  const limits = getTierLimits(tier);

  // Stripe.Subscription should have these properties, but we explicitly cast to ensure TypeScript recognizes them
  const currentPeriodStart = (subscription as any).current_period_start as number;
  const currentPeriodEnd = (subscription as any).current_period_end as number;

  await upsertSubscription({
    user_id: dbSubscription.user_id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_tier: tier,
    subscription_status: subscription.status,
    current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
    current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    max_clients: limits.maxClients,
    max_posts_per_month: limits.maxPostsPerMonth,
    max_ai_credits_per_month: limits.maxAICreditsPerMonth,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const dbSubscription = await getSubscriptionByCustomerId(customerId);

  if (!dbSubscription) {
    logger.error('Subscription not found for customer');
    return;
  }

  await upsertSubscription({
    user_id: dbSubscription.user_id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: 'canceled',
    cancel_at_period_end: false,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const dbSubscription = await getSubscriptionByCustomerId(customerId);

  if (!dbSubscription) {
    logger.error('Subscription not found for customer');
    return;
  }

  // Create billing history record
  await createBillingRecord({
    user_id: dbSubscription.user_id,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: customerId,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    invoice_pdf: invoice.invoice_pdf || undefined,
    invoice_url: invoice.hosted_invoice_url || undefined,
    status: invoice.status || 'paid',
    billing_reason: invoice.billing_reason || undefined,
    period_start: invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : undefined,
    period_end: invoice.period_end
      ? new Date(invoice.period_end * 1000)
      : undefined,
    paid_at: invoice.status_transitions.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : undefined,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const dbSubscription = await getSubscriptionByCustomerId(customerId);

  if (!dbSubscription) {
    logger.error('Subscription not found for customer');
    return;
  }

  // Update subscription status to past_due
  // Stripe Invoice subscription can be string | Stripe.Subscription | null
  const subscriptionId = (invoice as any).subscription as string | undefined;
  if (subscriptionId) {
    await updateSubscriptionStatus(
      subscriptionId,
      'past_due'
    );
  }

  // TODO: Send email notification to user about failed payment
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const dbSubscription = await getSubscriptionByCustomerId(customerId);

  if (!dbSubscription) {
    logger.error('Subscription not found for trial_will_end event');
    return;
  }

  // Log the event for monitoring
  logger.info(`Trial ending soon for user ${dbSubscription.user_id}, subscription ${subscription.id}`);

  // TODO: Send email reminder to user about trial ending
  // This could integrate with an email service like SendGrid, Resend, etc.
}
