-- Migration 007: Add connect_social onboarding checklist column to user_profiles
-- Run this in the Supabase SQL editor

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS checklist_connect_social BOOLEAN NOT NULL DEFAULT FALSE;
