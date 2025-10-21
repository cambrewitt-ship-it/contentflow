-- Add DELETE policy for user_profiles table
-- This allows users to delete their own profiles (for account deletion functionality)

-- Add DELETE policy for user profiles
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = id);

-- Grant DELETE permission to authenticated users
GRANT DELETE ON user_profiles TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Users can delete their own profile" ON user_profiles IS 'Allows users to delete their own profile for account deletion functionality';
