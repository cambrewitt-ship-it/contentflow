-- ============================================================
-- Migration 001: Backup subscriptions table
-- Run this FIRST before any other migrations
-- ============================================================

-- Create backup table with current date
-- Run this manually in Supabase SQL Editor
CREATE TABLE subscriptions_backup_20260203 AS
SELECT * FROM subscriptions;

-- Verify backup was created
SELECT
  'Backup created with ' || COUNT(*) || ' rows' as status
FROM subscriptions_backup_20260203;

-- Show current subscription distribution
SELECT
  subscription_tier,
  subscription_status,
  COUNT(*) as user_count
FROM subscriptions
GROUP BY subscription_tier, subscription_status
ORDER BY subscription_tier, subscription_status;
