import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

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

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Cron job to check for expired trials and downgrade them to freemium.
 * This handles no-CC trials that aren't managed by Stripe.
 *
 * Set up in Vercel Cron Jobs or similar to run daily.
 *
 * Example vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-trial-expiry",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (set CRON_SECRET in environment variables)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require authentication
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Unauthorized cron job attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date().toISOString();

    // Find expired trials (no-CC trials that we manage ourselves)
    // These have trial_ prefix in stripe_customer_id and no real stripe_subscription_id
    const { data: expiredTrials, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('subscription_tier', 'trial')
      .eq('subscription_status', 'trialing')
      .lt('current_period_end', now)
      .like('stripe_customer_id', 'trial_%'); // Only our no-CC trials

    if (fetchError) {
      logger.error('Error fetching expired trials:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      logger.info('No expired trials found');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No expired trials to process'
      });
    }

    logger.info(`Found ${expiredTrials.length} expired trial(s) to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each expired trial
    for (const trial of expiredTrials) {
      try {
        // Downgrade to freemium tier
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            subscription_tier: 'freemium',
            subscription_status: 'active',
            max_clients: 1,
            max_posts_per_month: 0,
            max_ai_credits_per_month: 10,
            metadata: {
              ...trial.metadata,
              trial_expired_at: now,
              downgraded_from: 'trial',
              previous_trial_end: trial.current_period_end,
            },
            updated_at: now,
          })
          .eq('id', trial.id);

        if (updateError) {
          logger.error(`Error downgrading trial for user ${trial.user_id}:`, updateError);
          errors.push(`User ${trial.user_id}: ${updateError.message}`);
          errorCount++;
        } else {
          logger.info(`Successfully downgraded trial for user ${trial.user_id}`);
          successCount++;

          // TODO: Send "trial expired" email notification
          // await sendTrialExpiredEmail(trial.user_id);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Exception processing trial for user ${trial.user_id}:`, err);
        errors.push(`User ${trial.user_id}: ${errorMsg}`);
        errorCount++;
      }
    }

    const response = {
      success: true,
      processed: expiredTrials.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info('Trial expiry cron job completed:', response);

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Trial expiry cron job failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
