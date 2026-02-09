-- ============================================================
-- TRIAL MIGRATION: Freemium → 14-Day Trial System
-- ============================================================
-- This migration:
-- 1. Creates a backup of the subscriptions table
-- 2. Adds trial tracking columns
-- 3. Migrates existing freemium users to a 30-day trial
-- 4. Updates the auto-assign trigger to create trial (not freemium)
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================

-- ============================================================
-- STEP 1: Backup existing subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions_backup_pre_trial AS
SELECT * FROM subscriptions;

-- Verify backup was created
SELECT COUNT(*) as backup_row_count FROM subscriptions_backup_pre_trial;

-- ============================================================
-- STEP 2: Add trial tracking columns
-- ============================================================
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS migrated_from_freemium BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legacy_user BOOLEAN DEFAULT FALSE;

-- ============================================================
-- STEP 3: Update the CHECK constraint to include 'trial'
-- (This may already exist from create-subscriptions-table.sql)
-- ============================================================
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_subscription_tier_check;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_subscription_tier_check
  CHECK (subscription_tier IN ('freemium', 'starter', 'professional', 'agency', 'trial'));

-- Also add 'expired' to the status constraint for trial expiration
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_subscription_status_check;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_subscription_status_check
  CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'incomplete_expired', 'unpaid', 'expired'));

-- ============================================================
-- STEP 4: Migrate existing freemium users to 30-day trial
-- (Existing users get 30 days as a courtesy; new signups get 14)
-- ============================================================
UPDATE subscriptions
SET
  subscription_tier = 'trial',
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '30 days',
  migrated_from_freemium = TRUE,
  legacy_user = TRUE,
  max_posts_per_month = 30,
  max_ai_credits_per_month = 100,
  stripe_customer_id = REPLACE(stripe_customer_id, 'freemium_', 'trial_'),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'migrated_from', 'freemium',
    'migration_date', NOW()::text,
    'original_trial_days', 30
  )
WHERE subscription_tier = 'freemium';

-- Verify migration
SELECT
  subscription_tier,
  subscription_status,
  COUNT(*) as user_count,
  COUNT(CASE WHEN migrated_from_freemium = TRUE THEN 1 END) as migrated_count,
  COUNT(CASE WHEN legacy_user = TRUE THEN 1 END) as legacy_count
FROM subscriptions
GROUP BY subscription_tier, subscription_status
ORDER BY subscription_tier;

-- ============================================================
-- STEP 5: Update trigger to assign 'trial' instead of 'freemium'
-- ============================================================
CREATE OR REPLACE FUNCTION assign_freemium_tier_to_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user already has a subscription
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE user_id = NEW.id
  ) THEN
    -- Create trial subscription for new user (14-day trial with starter-level limits)
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
      trial_start_date,
      trial_end_date,
      metadata
    ) VALUES (
      NEW.id,
      'trial_' || NEW.id,
      'trial',
      'active',
      1,              -- 1 client max
      30,             -- 30 posts per month (starter-level)
      100,            -- 100 AI credits per month (starter-level)
      0,
      0,
      0,
      NOW(),
      NOW(),
      NOW() + INTERVAL '14 days',
      jsonb_build_object('created_via', 'trial_signup', 'created_at', NOW()::text)
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create trial subscription for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger (in case it doesn't exist yet)
DROP TRIGGER IF EXISTS assign_freemium_tier_trigger ON auth.users;
CREATE TRIGGER assign_freemium_tier_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_freemium_tier_to_new_users();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check final state
SELECT
  subscription_tier,
  subscription_status,
  COUNT(*) as user_count,
  COUNT(CASE WHEN migrated_from_freemium = TRUE THEN 1 END) as migrated_count,
  COUNT(CASE WHEN trial_end_date IS NOT NULL THEN 1 END) as has_trial_end_date
FROM subscriptions
GROUP BY subscription_tier, subscription_status
ORDER BY subscription_tier;

-- Check trigger is set up correctly
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%freemium%' OR tgname LIKE '%trial%';

-- Check trigger function source
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'assign_freemium_tier_to_new_users';
