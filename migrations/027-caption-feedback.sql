-- ============================================================
-- Migration 027: Caption feedback + per-client caption playbook
-- Safe to run multiple times.
--
-- client_caption_rules is the client's "caption playbook": short rules
-- the Content Agent must follow on every run, created from feedback on
-- individual posts (or added by hand). Feedback and hand edits on
-- candidates are also kept so the style-preference learning knows *why*
-- a post was skipped or changed, not just that it was.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_caption_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rule TEXT NOT NULL CHECK (char_length(rule) BETWEEN 1 AND 500),
  source TEXT NOT NULL DEFAULT 'feedback' CHECK (source IN ('feedback', 'manual')),
  source_candidate_id UUID REFERENCES autopilot_candidates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caption_rules_client ON client_caption_rules(client_id, created_at);

ALTER TABLE client_caption_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_caption_rules' AND policyname = 'Users can manage caption rules for their clients'
  ) THEN
    CREATE POLICY "Users can manage caption rules for their clients" ON client_caption_rules
      FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Feedback left on a candidate during swipe review, and the AI's original
-- caption when it was edited or rewritten.
ALTER TABLE autopilot_candidates
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS feedback_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS original_caption TEXT;

-- Same on the preference training rows, so learning uses real reasons.
ALTER TABLE content_preferences
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS feedback_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS original_caption TEXT;
