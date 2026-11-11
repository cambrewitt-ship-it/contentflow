-- ============================================================
-- Migration 037: Comments on ads (dark posts and boosted posts)
-- Safe to run multiple times. Run after 036-comments-and-feed-checker.sql.
--
-- No ad account connection needed: ad comments reach the Page/Instagram
-- connection through Zernio's comment.received webhook (flagged as ads),
-- and an ad post's whole thread can be read with the Page connection.
-- client_ad_posts remembers the ad posts seen (or added by hand) so their
-- comments keep syncing.
-- ============================================================

ALTER TABLE client_comments ADD COLUMN IF NOT EXISTS is_ad BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE client_comments ADD COLUMN IF NOT EXISTS ad_id TEXT;
ALTER TABLE client_comments ADD COLUMN IF NOT EXISTS ad_title TEXT;

CREATE TABLE IF NOT EXISTS client_ad_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  ad_id TEXT,
  ad_title TEXT,
  post_text TEXT,
  post_url TEXT,
  post_thumbnail TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',   -- webhook | manual
  last_comment_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform, post_id)
);
CREATE INDEX IF NOT EXISTS idx_client_ad_posts_client ON client_ad_posts(client_id, last_comment_at DESC);

ALTER TABLE client_ad_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_ad_posts' AND policyname = 'Users can read ad posts for their clients') THEN
    CREATE POLICY "Users can read ad posts for their clients" ON client_ad_posts
      FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
  END IF;
END $$;
