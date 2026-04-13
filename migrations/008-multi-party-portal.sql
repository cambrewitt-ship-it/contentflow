-- ============================================================
-- Migration 008: Multi-Party Portal & Approval Pipeline
-- ============================================================
-- Adds:
--   1. portal_parties        — per-party identity + notification config
--   2. post_approval_steps   — sequential multi-step pipeline per post
--   3. workflow_templates    — reusable step configs per client
--   4. post_comments         — threaded comments replacing flat client_feedback
--   5. client_uploads alters — notes (already exists), uploaded_by_party_id, target_date, status rename
--   6. calendar_scheduled_posts alters — workflow_template_id, post_type_tag
--   7. Indexes on all new foreign keys
-- ============================================================


-- ============================================================
-- 1. portal_parties
-- ============================================================
CREATE TABLE IF NOT EXISTS portal_parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('media_agency', 'pr_agency', 'creative_agency', 'client', 'other')),
  portal_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  color TEXT,
  notification_channel TEXT CHECK (notification_channel IN ('email', 'slack', 'teams', NULL)),
  notification_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE portal_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage portal_parties for their clients"
  ON portal_parties FOR ALL
  USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_portal_parties_client_id ON portal_parties(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_parties_portal_token ON portal_parties(portal_token);


-- ============================================================
-- 2. workflow_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  post_type_tag TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workflow_templates for their clients"
  ON workflow_templates FOR ALL
  USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_workflow_templates_client_id ON workflow_templates(client_id);

CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. post_approval_steps
-- Uses post_id + post_type discriminator (same pattern as post_approvals)
-- Supports both calendar_scheduled_posts and scheduled_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS post_approval_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (post_type IN ('scheduled', 'calendar_scheduled')),
  step_order INT NOT NULL,
  party_id UUID REFERENCES portal_parties(id) ON DELETE SET NULL,
  -- agency_user_id is set instead of party_id when the step is actioned from the dashboard (e.g. TML)
  agency_user_id UUID,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  actioned_by TEXT,
  actioned_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, post_type, step_order)
);

ALTER TABLE post_approval_steps ENABLE ROW LEVEL SECURITY;

-- Agency users: full access to steps for posts belonging to their clients
CREATE POLICY "Users can manage post_approval_steps for their clients"
  ON post_approval_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_scheduled_posts csp
      JOIN clients c ON c.id = csp.client_id
      WHERE csp.id = post_approval_steps.post_id
        AND post_approval_steps.post_type = 'calendar_scheduled'
        AND c.user_id = auth.uid()
      UNION ALL
      SELECT 1 FROM scheduled_posts sp
      JOIN projects p ON p.id = sp.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE sp.id = post_approval_steps.post_id
        AND post_approval_steps.post_type = 'scheduled'
        AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_post_approval_steps_post_id ON post_approval_steps(post_id, post_type);
CREATE INDEX IF NOT EXISTS idx_post_approval_steps_party_id ON post_approval_steps(party_id);
CREATE INDEX IF NOT EXISTS idx_post_approval_steps_status ON post_approval_steps(status);

CREATE TRIGGER update_post_approval_steps_updated_at
  BEFORE UPDATE ON post_approval_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. post_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'calendar_scheduled' CHECK (post_type IN ('scheduled', 'calendar_scheduled')),
  -- One of these will be set, not both
  party_id UUID REFERENCES portal_parties(id) ON DELETE SET NULL,
  user_id UUID,
  author_name TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('agency', 'portal_party')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage post_comments for their clients"
  ON post_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_scheduled_posts csp
      JOIN clients c ON c.id = csp.client_id
      WHERE csp.id = post_comments.post_id
        AND post_comments.post_type = 'calendar_scheduled'
        AND c.user_id = auth.uid()
      UNION ALL
      SELECT 1 FROM scheduled_posts sp
      JOIN projects p ON p.id = sp.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE sp.id = post_comments.post_id
        AND post_comments.post_type = 'scheduled'
        AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id, post_type);
CREATE INDEX IF NOT EXISTS idx_post_comments_party_id ON post_comments(party_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at);


-- ============================================================
-- 5. Alter client_uploads
-- notes already exists per add-portal-fields.sql
-- Add: uploaded_by_party_id, target_date, rename status values
-- ============================================================
ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS uploaded_by_party_id UUID REFERENCES portal_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_date DATE;

-- Update status check constraint to include new values
-- (existing: pending | processing | completed | failed)
-- New values needed: unassigned | in_use | published
-- We drop and recreate the constraint with the expanded set
ALTER TABLE client_uploads DROP CONSTRAINT IF EXISTS client_uploads_status_check;
ALTER TABLE client_uploads
  ADD CONSTRAINT client_uploads_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'unassigned', 'in_use', 'published'));

CREATE INDEX IF NOT EXISTS idx_client_uploads_party_id ON client_uploads(uploaded_by_party_id);
CREATE INDEX IF NOT EXISTS idx_client_uploads_target_date ON client_uploads(target_date);


-- ============================================================
-- 6. Alter calendar_scheduled_posts
-- ============================================================
ALTER TABLE calendar_scheduled_posts
  ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES workflow_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_type_tag TEXT CHECK (post_type_tag IN ('pr_event', 'social', NULL));

CREATE INDEX IF NOT EXISTS idx_calendar_posts_workflow_template ON calendar_scheduled_posts(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_calendar_posts_post_type_tag ON calendar_scheduled_posts(post_type_tag);
