-- Add username field to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for username for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Add constraint to ensure username is not empty if provided
ALTER TABLE user_profiles ADD CONSTRAINT check_username_not_empty 
  CHECK (username IS NULL OR LENGTH(TRIM(username)) > 0);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.username IS 'Unique username for the user. Can be used for @mentions, display purposes, etc.';
