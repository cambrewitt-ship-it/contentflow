-- In-app notification center for the agency's own logged-in team.
--
-- This is deliberately separate from portal_parties / notification_channel /
-- /api/notifications/send — that system notifies external, token-based
-- client/agency-partner reviewers with no login. This table notifies TML's
-- own users (auth.users) inside the dashboard.
CREATE TABLE agency_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'autopilot_plan_ready',
    'autopilot_published',
    'autopilot_failed',
    'ad_copy_ready',
    'drive_sync_new_creative',
    'drive_sync_failed'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agency_notifications_user_unread ON agency_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_agency_notifications_user_created ON agency_notifications(user_id, created_at DESC);

ALTER TABLE agency_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications" ON agency_notifications
  FOR ALL USING (auth.uid() = user_id);
