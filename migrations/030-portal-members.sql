-- ============================================================
-- 030 — Individual portal profiles, comment replies and @mentions
--
--   1. portal_members          — one row per person (email) per client
--   2. portal_login_codes      — 6-digit email verification codes
--   3. portal_member_sessions  — per-device sign-ins (cookie token hashes)
--   4. post_comments alters    — member_id, parent_comment_id
--   5. comment_mentions        — who was tagged in which comment
--
-- All tables are accessed only through API routes using the service role,
-- so RLS is enabled with no policies (deny-all for anon/authenticated).
-- ============================================================


-- 1. portal_members
CREATE TABLE IF NOT EXISTS portal_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- The party link the person last signed in through (null for legacy client links)
  party_id UUID REFERENCES portal_parties(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_members_client_email_key
  ON portal_members (client_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_portal_members_party_id ON portal_members (party_id);

ALTER TABLE portal_members ENABLE ROW LEVEL SECURITY;


-- 2. portal_login_codes
CREATE TABLE IF NOT EXISTS portal_login_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_login_codes_lookup
  ON portal_login_codes (client_id, lower(email), created_at DESC);

ALTER TABLE portal_login_codes ENABLE ROW LEVEL SECURITY;


-- 3. portal_member_sessions
CREATE TABLE IF NOT EXISTS portal_member_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES portal_members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_member_sessions_member_id
  ON portal_member_sessions (member_id);

ALTER TABLE portal_member_sessions ENABLE ROW LEVEL SECURITY;


-- 4. post_comments — author profile and replies
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES portal_members(id) ON DELETE SET NULL;
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_member_id ON post_comments (member_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id ON post_comments (parent_comment_id);


-- 5. comment_mentions — exactly one of member_id / user_id is set
CREATE TABLE IF NOT EXISTS comment_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  member_id UUID REFERENCES portal_members(id) ON DELETE CASCADE,
  user_id UUID,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK ((member_id IS NULL) <> (user_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON comment_mentions (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_member_id ON comment_mentions (member_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON comment_mentions (user_id);

ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;
