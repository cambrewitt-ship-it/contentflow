import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyWebhookSignature, getTierByPriceId } from '@/lib/stripe';
import {
  upsertSubscription,
  updateSubscriptionStatus,
  getSubscriptionByCustomerId,
  deleteSubscription,
  createBillingRecord,
  getTierLimits,
} from '@/lib/subscriptionHelpers';
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

  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }

  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
    };

const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
    };

const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
    };

const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
    };

const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
    };

const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
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

  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !customerId) {
    logger.error('Missing userId or customerId in session metadata');
    return;
  }

  // We'll get the full subscription details from the subscription.created event
  // For now, just create a basic record
  const tier = 'starter'; // Default tier, will be updated by subscription.created event
  const limits = getTierLimits(tier);

  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId || null,
    subscription_tier: tier,
    subscription_status: 'active',
    max_clients: limits.maxClients,
    max_posts_per_month: limits.maxPostsPerMonth,
    max_ai_credits_per_month: limits.maxAICreditsPerMonth,

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

  }

  // TODO: Send email notification to user about failed payment
}

