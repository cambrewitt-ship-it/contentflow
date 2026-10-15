-- ============================================================
-- Migration 030: Competitor research
-- Safe to run multiple times.
--
-- research_profile    what the research agent needs to know about the client's
--                     niche (category, location, keywords) to find accounts
--                     and trends. Defaults are derived from the brand profile
--                     until the user saves their own.
-- competitor_accounts Instagram / TikTok accounts tracked per client:
--                     direct competitors and other accounts in the niche
--                     worth learning from.
-- competitor_research_reports
--                     one row per research run; the insights live in `report`.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS research_profile JSONB;

CREATE TABLE IF NOT EXISTS competitor_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  handle TEXT NOT NULL CHECK (char_length(handle) BETWEEN 1 AND 100),
  relationship TEXT NOT NULL DEFAULT 'competitor' CHECK (relationship IN ('competitor', 'inspiration')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'discovered')),
  display_name TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER,
  media_count INTEGER,
  notes TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_accounts_unique
  ON competitor_accounts(client_id, platform, lower(handle));

ALTER TABLE competitor_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_accounts' AND policyname = 'Users can manage competitor accounts for their clients'
  ) THEN
    CREATE POLICY "Users can manage competitor accounts for their clients" ON competitor_accounts
      FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS competitor_research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  progress TEXT,
  include_trends BOOLEAN NOT NULL DEFAULT TRUE,
  accounts_analyzed INTEGER NOT NULL DEFAULT 0,
  posts_analyzed INTEGER NOT NULL DEFAULT 0,
  report JSONB,
  warnings TEXT[] DEFAULT '{}',
  error TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_reports_client
  ON competitor_research_reports(client_id, created_at DESC);

ALTER TABLE competitor_research_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_research_reports' AND policyname = 'Users can manage research reports for their clients'
  ) THEN
    CREATE POLICY "Users can manage research reports for their clients" ON competitor_research_reports
      FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;
