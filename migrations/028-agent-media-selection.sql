-- ============================================================
-- Migration 028: Content Agent photo selection
-- Safe to run multiple times.
--
-- agent_media_ids limits the Content Agent to a hand-picked set of
-- media_gallery photos. NULL (the default) means the agent can use
-- every available, analyzed photo — existing clients keep their
-- current behaviour.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS agent_media_ids UUID[];
