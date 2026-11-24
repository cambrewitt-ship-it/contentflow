-- ============================================================
-- Migration 034: Client analytics snapshots
-- Safe to run multiple times.
--
-- One row per client: their published posts' results (read from
-- Zernio's analytics), best posting times, computed performance
-- insights and the AI's weekly recommendations. Refreshed at most
-- every few hours, so pages and AI prompts don't call Zernio each time.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_analytics (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  insights JSONB,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ok',
  message TEXT,
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_analytics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_analytics' AND policyname = 'Users can read analytics for their clients'
  ) THEN
    CREATE POLICY "Users can read analytics for their clients" ON client_analytics
      FOR SELECT USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Weekly insights notification
ALTER TABLE agency_notifications DROP CONSTRAINT IF EXISTS agency_notifications_type_check;
ALTER TABLE agency_notifications ADD CONSTRAINT agency_notifications_type_check CHECK (type IN (
  'autopilot_plan_ready',
  'autopilot_published',
  'autopilot_failed',
  'ad_copy_ready',
  'drive_sync_new_creative',
  'drive_sync_failed',
  'analytics_insights'
));
