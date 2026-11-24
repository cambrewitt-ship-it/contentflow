-- ============================================================
-- 038 — Approval update emails ("Notify by email" in the calendar)
--
-- People (any email address, or a portal member picked from the list) who get
-- an email whenever a client's post gets an approval update: approved, improve
-- requested, rejected, status cleared, a new comment, or moved to another date
-- from the portal. Covers the content portal and approval links.
--
-- Accessed only through API routes with the service role, so RLS is enabled
-- with no policies (deny-all for anon/authenticated). Run by hand in Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_watchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  -- Set when the address belongs to someone who has signed in to the portal
  member_id UUID REFERENCES portal_members(id) ON DELETE SET NULL,
  -- Lets the recipient stop the emails from the link in the footer
  unsubscribe_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS approval_watchers_client_email_key
  ON approval_watchers (client_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS approval_watchers_unsubscribe_token_key
  ON approval_watchers (unsubscribe_token);

ALTER TABLE approval_watchers ENABLE ROW LEVEL SECURITY;
