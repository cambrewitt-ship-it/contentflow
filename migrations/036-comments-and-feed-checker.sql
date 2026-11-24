-- ============================================================
-- Migration 036: Comments inbox and the Feed Checker agent
-- Safe to run multiple times. Run after 035-client-reports.sql.
--
-- client_comments      comments on clients' posts (from Zernio's Comments API and
--                      comment.received webhooks) with the AI's triage and what
--                      was done about each one
-- zernio_webhook_events  dedupe for incoming Zernio webhooks
-- client_feed_checks   the Feed Checker's findings per post (spelling, tone of
--                      voice, "link in comments" with no link)
-- clients.feed_agent_settings      per-client Feed Checker settings
-- calendar_scheduled_posts.first_comment  a comment (usually the link) posted
--                      as soon as the post goes live
-- ============================================================

CREATE TABLE IF NOT EXISTS client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  platform_comment_id TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  parent_comment_id TEXT,
  post_text TEXT,
  post_url TEXT,
  post_thumbnail TEXT,
  author_id TEXT,
  author_name TEXT,
  author_username TEXT,
  author_picture TEXT,
  is_own BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT '',
  comment_url TEXT,
  commented_at TIMESTAMPTZ,
  can_reply BOOLEAN NOT NULL DEFAULT true,
  can_hide BOOLEAN NOT NULL DEFAULT false,
  can_like BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_liked BOOLEAN NOT NULL DEFAULT false,
  -- AI triage
  sentiment TEXT,            -- positive | neutral | negative
  category TEXT,             -- praise | question | complaint | spam | abuse | other
  needs_reply BOOLEAN,
  suggested_reply TEXT,
  suggested_private_reply TEXT,
  triage_note TEXT,
  triaged_at TIMESTAMPTZ,
  -- Handling
  status TEXT NOT NULL DEFAULT 'new',   -- new | replied | done | hidden | deleted
  reply_text TEXT,
  auto_action TEXT,                     -- hidden | liked | hearted (done by the Feed Checker)
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform, platform_comment_id)
);
CREATE INDEX IF NOT EXISTS idx_client_comments_client_time ON client_comments(client_id, commented_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_comments_open ON client_comments(client_id, status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_client_comments_post ON client_comments(client_id, platform_post_id);

CREATE TABLE IF NOT EXISTS zernio_webhook_events (
  id TEXT PRIMARY KEY,
  event TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_feed_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                 -- published | scheduled
  platform TEXT NOT NULL,
  post_ref TEXT NOT NULL,               -- platform post id, or calendar post id for scheduled posts
  account_id TEXT,
  late_post_id TEXT,
  calendar_post_id UUID,
  post_text TEXT,
  post_url TEXT,
  post_thumbnail TEXT,
  posted_at TIMESTAMPTZ,
  content_hash TEXT,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  tov_score INTEGER,
  suggested_caption TEXT,
  status TEXT NOT NULL DEFAULT 'ok',    -- ok | open | resolved | ignored
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (client_id, source, platform, post_ref)
);
CREATE INDEX IF NOT EXISTS idx_client_feed_checks_open ON client_feed_checks(client_id, status, checked_at DESC);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS feed_agent_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS feed_agent_last_run JSONB;
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS first_comment TEXT;
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS first_comment_posted_at TIMESTAMPTZ;

ALTER TABLE client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_feed_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE zernio_webhook_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_comments' AND policyname = 'Users can read comments for their clients') THEN
    CREATE POLICY "Users can read comments for their clients" ON client_comments
      FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_feed_checks' AND policyname = 'Users can read feed checks for their clients') THEN
    CREATE POLICY "Users can read feed checks for their clients" ON client_feed_checks
      FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Notifications for comments and the Feed Checker
ALTER TABLE agency_notifications DROP CONSTRAINT IF EXISTS agency_notifications_type_check;
ALTER TABLE agency_notifications ADD CONSTRAINT agency_notifications_type_check CHECK (type IN (
  'autopilot_plan_ready',
  'autopilot_published',
  'autopilot_failed',
  'ad_copy_ready',
  'drive_sync_new_creative',
  'drive_sync_failed',
  'analytics_insights',
  'monthly_report_ready',
  'feed_check_issues',
  'comments_need_attention'
));
