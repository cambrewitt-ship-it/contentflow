import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, getAuthenticatedUser } from '@/lib/supabaseServer';
import { handleApiError, extractErrorContext } from '@/lib/secureErrorHandler';
import logger from '@/lib/logger';
import { getUserContact, sendAccountDeletedEmail } from '@/lib/emails';
import { stripe } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscriptionHelpers';

/** Stripe statuses that can still bill the customer. */
const LIVE_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused']);

/**
 * Cancel every live Stripe subscription for this user, immediately.
 * Throws if any cancellation fails, so we never delete an account that
 * would keep getting charged.
 */
async function cancelStripeSubscriptions(userId: string): Promise<number> {
  const dbSubscription = await getUserSubscription(userId);
  const customerId = dbSubscription?.stripe_customer_id;
  if (!customerId) return 0;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  let canceled = 0;
  for (const sub of subscriptions.data) {
    if (!LIVE_STATUSES.has(sub.status)) continue;
    await stripe.subscriptions.cancel(sub.id, {
      // Lets the webhook skip the "subscription ended" email — the user gets
      // the account-deleted email instead.
      cancellation_details: { comment: 'account_deleted' },
    });
    canceled++;
  }
  return canceled;
}

export async function DELETE(req: NextRequest) {
  const errorContext = extractErrorContext(req);

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleApiError(
        new Error('No authorization header'),
        { ...errorContext, operation: 'delete_account_auth' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    const token = authHeader.split(' ')[1];

    // Get the authenticated user using secure token validation
    const user = await getAuthenticatedUser(token);
    if (!user) {
      return handleApiError(
        new Error('Invalid token'),
        { ...errorContext, operation: 'delete_account_auth' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    errorContext.userId = user.id;

    // Create admin Supabase client for user deletion
    const supabaseAdmin = createSupabaseAdmin();

    logger.info('🗑️ User account deletion initiated', {
      userId: user.id,
      email: user.email,
    });

    // Capture name/email now — the auth user is gone by the time we email.
    const contact = await getUserContact(user.id);

    // Stop billing before deleting anything. If Stripe fails, abort so the
    // user isn't left with no account but an active subscription.
    try {
      const canceled = await cancelStripeSubscriptions(user.id);
      logger.info('Stripe subscriptions canceled for account deletion', {
        userId: user.id,
        canceled,
      });
    } catch (stripeError) {
      logger.error('❌ Failed to cancel Stripe subscription during account deletion:', stripeError);
      return handleApiError(
        stripeError,
        { ...errorContext, operation: 'delete_account_cancel_subscription' },
        'INTERNAL_ERROR'
      );
    }

    // Start a transaction-like operation to delete user data
    try {
      // First, delete the user profile (this will cascade to related data due to foreign key constraints)
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        logger.error('❌ Failed to delete user profile:', profileError);
        return handleApiError(
          profileError,
          { ...errorContext, operation: 'delete_user_profile' },
          'DATABASE_ERROR'
        );
      }

      // Delete the auth user (this will also trigger cascade deletes for related tables)
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (authError) {
        logger.error('❌ Failed to delete auth user:', authError);
        return handleApiError(
          authError,
          { ...errorContext, operation: 'delete_auth_user' },
          'DATABASE_ERROR'
        );
      }

      logger.info('✅ User account successfully deleted', {
        userId: user.id,
        email: user.email,
      });

      const deletedEmail = contact?.email ?? user.email;
      if (deletedEmail) {
        await sendAccountDeletedEmail({ email: deletedEmail, name: contact?.name });
      }

      return NextResponse.json({
        success: true,
        message: 'Account successfully deleted',
      });
    } catch (deleteError: any) {
      logger.error('❌ Error during account deletion process:', deleteError);
      return handleApiError(
        deleteError,
        { ...errorContext, operation: 'delete_account_process' },
        'DATABASE_ERROR'
      );
    }
  } catch (error: any) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'delete_account' },
      'INTERNAL_ERROR'
    );
  }
}
