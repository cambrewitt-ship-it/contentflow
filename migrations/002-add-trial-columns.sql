-- ============================================================
-- Migration 002: Add trial tracking columns
-- Safe to run - uses IF NOT EXISTS
-- ============================================================

-- Add new columns for trial tracking
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS migrated_from_freemium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS legacy_user BOOLEAN DEFAULT FALSE;

-- Add index for efficient trial expiration queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date
ON subscriptions(trial_end_date)
WHERE trial_end_date IS NOT NULL;

-- Add index for finding trial users
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_status
ON subscriptions(subscription_tier, subscription_status)
WHERE subscription_tier = 'trial';

-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
AND column_name IN ('trial_start_date', 'trial_end_date', 'migrated_from_freemium', 'legacy_user')
ORDER BY column_name;
