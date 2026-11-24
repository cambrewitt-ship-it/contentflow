-- ============================================================
-- Migration 035: Monthly client reports
-- Safe to run multiple times. Run after 034-client-analytics.sql.
--
-- One report per client per month: the month's results from Zernio,
-- top posts and an AI-written plain-English summary, frozen when it's
-- generated. share_token makes a read-only link for the client
-- (/report/<token>, no login).
-- ============================================================

CREATE TABLE IF NOT EXISTS client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_client_reports_client ON client_reports(client_id, period_start DESC);

ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_reports' AND policyname = 'Users can read reports for their clients'
  ) THEN
    CREATE POLICY "Users can read reports for their clients" ON client_reports
      FOR SELECT USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Monthly report notification
ALTER TABLE agency_notifications DROP CONSTRAINT IF EXISTS agency_notifications_type_check;
ALTER TABLE agency_notifications ADD CONSTRAINT agency_notifications_type_check CHECK (type IN (
  'autopilot_plan_ready',
  'autopilot_published',
  'autopilot_failed',
  'ad_copy_ready',
  'drive_sync_new_creative',
  'drive_sync_failed',
  'analytics_insights',
  'monthly_report_ready'
));
