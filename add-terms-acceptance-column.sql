-- Add terms acceptance tracking to user_profiles table
-- This migration adds a column to track when users accepted the terms and conditions

-- Add column to track terms acceptance
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on terms acceptance
CREATE INDEX IF NOT EXISTS idx_user_profiles_terms_accepted 
ON user_profiles(terms_accepted_at);

-- Optional: Add comment to document the column
COMMENT ON COLUMN user_profiles.terms_accepted_at IS 'Timestamp when the user accepted the terms and conditions during signup';

