-- ============================================================
-- Migration 024: Re-label comments left through one-time approval links
-- Safe to run multiple times.
--
-- The approval link used to save comments on calendar posts with
-- post_type = 'scheduled', but the calendar and portal comment threads read
-- 'calendar_scheduled', so those comments never showed up. Only rows whose
-- post_id is a calendar post are touched.
-- ============================================================

UPDATE post_comments
SET post_type = 'calendar_scheduled'
WHERE post_type = 'scheduled'
  AND post_id IN (SELECT id FROM calendar_scheduled_posts);
