-- ============================================================
-- Migration 025: Content Agent drafts
-- Safe to run multiple times.
--
-- After swiping, kept candidates go one of two ways:
--   * "Add to Calendar" -> a row in calendar_unscheduled_posts (unchanged)
--   * "Save to Drafts"  -> the candidate stays put and is flagged here, so the
--                          Content Agent page can list it in its Drafts section.
-- ============================================================

ALTER TABLE autopilot_candidates
  ADD COLUMN IF NOT EXISTS saved_to_drafts BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE autopilot_candidates
  ADD COLUMN IF NOT EXISTS saved_to_drafts_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_candidates_drafts
  ON autopilot_candidates(client_id, saved_to_drafts_at DESC)
  WHERE saved_to_drafts;

-- 'draft' is already permitted by the autopilot_plans status check constraint
-- (see 013-autopilot-plans.sql); a plan whose kept posts were saved to drafts
-- is marked 'draft' so the page doesn't re-open it as the active plan.
