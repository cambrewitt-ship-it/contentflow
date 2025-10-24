-- Add freemium tier support to existing subscriptions table
-- This script safely adds the freemium tier without conflicting with existing policies

-- 1. Update the subscription_tier check constraint to include 'freemium'
-- First, drop the existing constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_subscription_tier_check;

-- Add the new constraint with freemium included
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_subscription_tier_check 
CHECK (subscription_tier IN ('freemium', 'starter', 'professional', 'agency', 'trial'));

-- 2. Update default values to support freemium tier
-- No changes needed as the defaults are already appropriate

-- 3. Create a function to automatically assign freemium tier to new users without subscriptions
CREATE OR REPLACE FUNCTION assign_freemium_tier_to_new_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a subscription
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE user_id = NEW.id
  ) THEN
    -- Create freemium subscription for new user
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
      0, -- No social media posting
      10, -- 10 AI credits per month
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

-- 4. Create trigger to automatically assign freemium tier to new users
DROP TRIGGER IF EXISTS assign_freemium_tier_trigger ON auth.users;
CREATE TRIGGER assign_freemium_tier_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_freemium_tier_to_new_users();

-- 5. Update existing users without subscriptions to freemium tier
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
)
SELECT 
  u.id,
  'freemium_' || u.id,
  'freemium',
  'active',
  1,
  0, -- No social media posting
  10, -- 10 AI credits per month
  0,
  0,
  0,
  NOW(),
  jsonb_build_object('created_via', 'freemium_migration', 'created_at', NOW()::text)
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
);

-- 6. Verify the migration
SELECT 
  subscription_tier,
  COUNT(*) as user_count,
  AVG(max_clients) as avg_max_clients,
  AVG(max_posts_per_month) as avg_max_posts,
  AVG(max_ai_credits_per_month) as avg_max_ai_credits
FROM subscriptions 
GROUP BY subscription_tier
ORDER BY subscription_tier;
