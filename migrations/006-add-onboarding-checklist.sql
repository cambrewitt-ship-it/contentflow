-- Migration 006: Add onboarding checklist columns to user_profiles
-- Run this in the Supabase SQL editor or via Supabase CLI

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS checklist_business_profile BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checklist_create_post      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checklist_add_to_calendar  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checklist_publish_post     BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow authenticated users to update their own checklist columns
-- (user_profiles already has RLS - this extends the existing update policy)
-- If you have a restrictive update policy, add these columns to it.
-- Example (run only if needed):
-- DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
-- CREATE POLICY "Users can update own profile" ON user_profiles
--   FOR UPDATE USING (auth.uid() = id);
