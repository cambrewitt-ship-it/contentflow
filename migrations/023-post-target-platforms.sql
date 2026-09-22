-- ============================================================
-- Migration 023: Mark calendar posts with their intended social platforms
-- Safe to run multiple times.
--
-- target_platforms is what the agency ticks in the calendar post modal
-- (e.g. {facebook,instagram}). It drives the platform logos on calendar
-- cards and which social preview the approval link shows. It is separate
-- from platforms_scheduled, which records where LATE actually scheduled it.
-- ============================================================

ALTER TABLE calendar_scheduled_posts
  ADD COLUMN IF NOT EXISTS target_platforms TEXT[] NOT NULL DEFAULT '{}';
