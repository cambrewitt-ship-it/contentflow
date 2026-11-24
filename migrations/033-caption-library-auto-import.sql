-- ============================================================
-- Migration 033: Caption library auto-import
-- Safe to run multiple times. Run after 032-caption-library.sql.
--
-- @handles from a client's past captions (in the calendar and, via
-- Zernio's analytics, on Instagram itself) are saved as accounts
-- automatically.
--   dismissed_handles   handles someone deleted, so they aren't re-added
--   external_usage      handle/hashtag counts from posts made outside the app
--   external_synced_at  when external_usage was last read from Zernio
-- ============================================================

ALTER TABLE client_caption_libraries
  ADD COLUMN IF NOT EXISTS dismissed_handles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS external_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;
