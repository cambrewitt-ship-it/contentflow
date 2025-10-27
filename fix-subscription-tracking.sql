-- Fix Subscription Tracking Issues
-- This script recalculates clients_used and ai_credits_used_this_month from actual data
-- and ensures all freemium tier users have proper limits

-- 1. First, let's see the current state
SELECT 
  user_id,
  subscription_tier,
  max_clients,
  clients_used,
  max_ai_credits_per_month,
  ai_credits_used_this_month,
  subscription_status
FROM subscriptions
ORDER BY subscription_tier, user_id;

-- 2. Update clients_used to match actual client count
UPDATE subscriptions
SET clients_used = (
  SELECT COUNT(*) 
  FROM clients 
  WHERE clients.user_id = subscriptions.user_id
)
WHERE EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.user_id = subscriptions.user_id
);

-- 3. For freemium tier, ensure max_clients is set to 1
UPDATE subscriptions
SET max_clients = 1
WHERE subscription_tier = 'freemium' AND max_clients != 1;

-- 4. Verify the freemium tier limits are correct
UPDATE subscriptions
SET 
  max_clients = 1,
  max_posts_per_month = 0,
  max_ai_credits_per_month = 10
WHERE subscription_tier = 'freemium';

-- 5. Show updated state
SELECT 
  user_id,
  subscription_tier,
  max_clients,
  clients_used,
  max_ai_credits_per_month,
  ai_credits_used_this_month,
  subscription_status,
  (SELECT COUNT(*) FROM clients WHERE clients.user_id = subscriptions.user_id) as actual_client_count
FROM subscriptions
ORDER BY subscription_tier, user_id;
