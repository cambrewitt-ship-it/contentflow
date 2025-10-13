-- SECURE FIX: Better RLS for user_profiles with proper role permissions
-- This approach uses role-based access instead of allowing NULL auth

-- Step 1: Remove the potentially insecure policy
DROP POLICY IF EXISTS "Allow signup trigger to insert profiles" ON user_profiles;

-- Step 2: Create a more secure policy that only allows service_role
-- Note: This policy specifically targets the service_role which the trigger uses
CREATE POLICY "Service role can insert profiles during signup" ON user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Step 3: Keep the user-facing policies secure
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id);

-- This allows authenticated users to insert their own profile (for manual profile creation)
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 4: Ensure the trigger function has proper permissions
-- The SECURITY DEFINER makes it run as the function owner (with elevated privileges)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- Runs with elevated privileges, bypassing RLS
SET search_path = public -- Prevents search_path injection attacks
AS $$
BEGIN
  -- Insert user profile
  -- This executes with SECURITY DEFINER privileges, so it bypasses RLS
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Grant necessary permissions explicitly
GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- Step 6: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Verify RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Optional: Add a policy for public reads if you want profiles to be viewable by others
-- Uncomment if needed:
-- CREATE POLICY "Public profiles are viewable by authenticated users" ON user_profiles
--   FOR SELECT 
--   TO authenticated
--   USING (true);

