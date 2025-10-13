-- FIX: User Profiles RLS for Signup Trigger
-- Problem: RLS blocks the trigger function from inserting user profiles during signup
-- Solution: Add a policy that allows inserts during trigger execution (when auth.uid() is NULL)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Recreate policies with proper permissions

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE 
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- CRITICAL FIX: Allow service role (trigger function) to insert during signup
-- When the trigger runs, auth.uid() is NULL because user isn't authenticated yet
-- This policy allows inserts when there's no authenticated user (during trigger execution)
CREATE POLICY "Service role can insert profiles" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- Alternative approach: Grant direct insert permission to the function
-- This ensures the trigger function can always insert regardless of RLS
GRANT INSERT ON user_profiles TO postgres, authenticated, service_role;

-- Verify the trigger function has SECURITY DEFINER (it should bypass RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
AS $$
BEGIN
  -- Insert into user_profiles table
  -- This will use the SECURITY DEFINER privilege to bypass RLS
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON user_profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

