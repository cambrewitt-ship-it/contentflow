-- ============================================================
-- Migration 005: ROLLBACK SCRIPT - EMERGENCY USE ONLY
-- Run this if something breaks and you need to revert
-- ============================================================

-- WARNING: This will revert migrated users back to freemium
-- Only run if there's a critical issue

-- Rollback migrated users to freemium
UPDATE subscriptions
SET
  subscription_tier = 'freemium',
  subscription_status = 'active',
  trial_start_date = NULL,
  trial_end_date = NULL,
  current_period_start = NULL,
  current_period_end = NULL,
  max_clients = 1,
  max_posts_per_month = 0,
  max_ai_credits_per_month = 10,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{rollback_note}',
    ('"Rolled back to freemium on ' || NOW()::text || '"')::jsonb
  ),
  updated_at = NOW()
WHERE migrated_from_freemium = TRUE
  AND stripe_subscription_id IS NULL;  -- Only rollback non-paying users

-- Restore original trigger function
CREATE OR REPLACE FUNCTION assign_freemium_tier_to_new_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE user_id = NEW.id
  ) THEN
    INSERT INTO subscriptions (
      user_id,
      stripe_customer_id,
      subscription_tier,
      subscription_status,
      max_clients,
      max_posts_per_month,
      max_ai_credits_per_month,
      clients_used,
      posts_used_this_month,
      ai_credits_used_this_month,
      usage_reset_date,
      metadata
    ) VALUES (
      NEW.id,
      'freemium_' || NEW.id,
      'freemium',
      'active',
      1,
      0,
      10,
      0,
      0,
      0,
      NOW(),
      jsonb_build_object('created_via', 'freemium_signup', 'created_at', NOW()::text)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify rollback
SELECT
  subscription_tier,
  subscription_status,
  COUNT(*) as count
FROM subscriptions
GROUP BY subscription_tier, subscription_status
ORDER BY subscription_tier;
