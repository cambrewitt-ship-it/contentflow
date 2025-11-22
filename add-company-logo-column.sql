-- Add company logo URL column to user_profiles table
-- This allows users on Freelancer and Agency plans to upload their company logo

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_logo ON user_profiles(company_logo_url);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.company_logo_url IS 'URL to the company logo stored in Vercel Blob storage. Available for Freelancer and Agency plan users.';

