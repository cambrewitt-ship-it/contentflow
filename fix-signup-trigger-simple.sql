-- SIMPLE FIX: Allow signup trigger to create user profiles
-- This adds a policy that allows inserts when auth.uid() is NULL (during signup)

-- Add policy for service role / trigger function
CREATE POLICY "Allow signup trigger to insert profiles" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- Update the trigger function to handle errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

