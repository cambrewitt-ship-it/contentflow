-- ============================================================
-- Migration 026: Brand Tone of Voice (TOV) document
-- Safe to run multiple times.
--
-- brand_tov holds a brand's tone-of-voice guide as markdown. It is
-- transcribed by AI from an uploaded PDF/Word/text document (or typed
-- directly) and injected into every AI copy prompt as the brand's
-- copy rules.
--
-- The use_* flags let the agency choose which voice sources the AI
-- follows for this client. All default on so existing clients keep
-- their current behaviour (examples + do's/don'ts).
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS brand_tov TEXT,
  ADD COLUMN IF NOT EXISTS brand_tov_source_filename TEXT,
  ADD COLUMN IF NOT EXISTS brand_tov_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS use_brand_tov BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS use_voice_examples BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS use_caption_rules BOOLEAN NOT NULL DEFAULT TRUE;
