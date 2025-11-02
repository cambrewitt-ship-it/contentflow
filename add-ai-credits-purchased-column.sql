-- Add ai_credits_purchased column to user_profiles table
-- This tracks purchased credits separately from monthly subscription credits

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS ai_credits_purchased INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.ai_credits_purchased IS 'Total purchased AI credits that stack on top of monthly subscription credits. These credits never expire and accumulate over time.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_ai_credits_purchased 
ON user_profiles(ai_credits_purchased);

-- Ensure the default is 0 for existing users
UPDATE user_profiles 
SET ai_credits_purchased = 0 
WHERE ai_credits_purchased IS NULL;

