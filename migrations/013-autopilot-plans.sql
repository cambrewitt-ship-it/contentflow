-- Autopilot Plans: AI-generated content plans
CREATE TABLE autopilot_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),

  -- Plan window
  plan_week_start DATE NOT NULL,
  plan_week_end DATE NOT NULL,
  posts_planned INTEGER DEFAULT 0,
  posts_approved INTEGER DEFAULT 0,

  -- AI reasoning
  ai_plan_summary TEXT,
  ai_context_snapshot JSONB,
  events_considered JSONB DEFAULT '[]'::jsonb,

  -- Status
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'draft', 'pending_approval', 'partially_approved', 'approved', 'published', 'failed')),

  -- Approval
  approval_token UUID DEFAULT gen_random_uuid(),
  approved_at TIMESTAMPTZ,

  -- Notification
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_autopilot_plans_client ON autopilot_plans(client_id, plan_week_start DESC);
CREATE INDEX idx_autopilot_plans_user ON autopilot_plans(user_id);
CREATE INDEX idx_autopilot_plans_status ON autopilot_plans(status);
CREATE INDEX idx_autopilot_plans_token ON autopilot_plans(approval_token);

-- Updated_at trigger
CREATE TRIGGER update_autopilot_plans_updated_at
  BEFORE UPDATE ON autopilot_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE autopilot_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own autopilot plans" ON autopilot_plans
  FOR ALL USING (auth.uid() = user_id);

-- Extend clients table with autopilot + operational fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS posting_preferences JSONB DEFAULT '{"posts_per_week": 3, "preferred_days": ["tuesday", "thursday", "saturday"], "preferred_times": ["12:00", "17:00"], "avoid_days": [], "content_mix": {"promotional": 30, "engagement": 40, "seasonal": 20, "educational": 10}}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_context JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS autopilot_settings JSONB DEFAULT '{"auto_generate": false, "generation_day": "sunday", "planning_horizon_days": 7, "require_approval": true, "notify_via": "email", "auto_publish_if_no_response": false}'::jsonb;

-- Extend calendar_scheduled_posts with autopilot fields
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'autopilot'));
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS autopilot_plan_id UUID REFERENCES autopilot_plans(id) ON DELETE SET NULL;
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS media_gallery_id UUID REFERENCES media_gallery(id) ON DELETE SET NULL;
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE calendar_scheduled_posts ADD COLUMN IF NOT EXISTS autopilot_status TEXT CHECK (autopilot_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'edited_and_approved'));

CREATE INDEX idx_csp_autopilot_plan ON calendar_scheduled_posts(autopilot_plan_id);
CREATE INDEX idx_csp_source ON calendar_scheduled_posts(source);
CREATE INDEX idx_csp_media_gallery ON calendar_scheduled_posts(media_gallery_id);
