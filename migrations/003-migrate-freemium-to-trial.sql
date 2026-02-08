-- ============================================================
-- Migration 003: Migrate existing freemium users to 30-day trial
-- IMPORTANT: Run this AFTER deploying code changes
-- ============================================================

-- First, let's see what we're about to migrate
SELECT
  id,
  user_id,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  created_at
FROM subscriptions
WHERE subscription_tier = 'freemium';

-- Migrate existing freemium users to 30-day trial with legacy marker
-- They get 30 days (instead of 14) as a thank-you for being early users
UPDATE subscriptions
SET
  subscription_tier = 'trial',
  subscription_status = 'trialing',
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '30 days',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  max_clients = 5,              -- Upgrade to professional limits
  max_posts_per_month = 150,
  max_ai_credits_per_month = 500,
  migrated_from_freemium = TRUE,
  legacy_user = TRUE,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{migration_note}',
    '"Upgraded from freemium on 2026-02-03 - 30 day trial, no CC required"'::jsonb
  ),
  updated_at = NOW()
WHERE subscription_tier = 'freemium';

-- Verify migration results
SELECT
  subscription_tier,
  subscription_status,
  migrated_from_freemium,
  legacy_user,
  COUNT(*) as count,
  MIN(trial_end_date) as earliest_trial_end,
  MAX(trial_end_date) as latest_trial_end
FROM subscriptions
GROUP BY subscription_tier, subscription_status, migrated_from_freemium, legacy_user
ORDER BY subscription_tier;
