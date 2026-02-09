-- ============================================================
-- Migration 004: Update trigger to create trial subscriptions for new users
-- Run this AFTER migrating existing users
-- ============================================================

-- Update function to assign trial tier instead of freemium
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
    -- Create 14-day trial subscription for new user
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

-- Optionally rename trigger for clarity (the function name stays the same for safety)
-- The trigger already exists, so we just update the function it calls
-- No need to recreate the trigger since it references the function by name

-- Verify the function was updated
SELECT
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'assign_freemium_tier_to_new_users';

-- Verify trigger exists and is active
SELECT
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname LIKE '%freemium%' OR tgname LIKE '%trial%';
