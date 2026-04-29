-- Autopilot Candidates: individual post candidates for swipe review
CREATE TABLE autopilot_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autopilot_plan_id UUID NOT NULL REFERENCES autopilot_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Content
  media_gallery_id UUID REFERENCES media_gallery(id),
  media_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',

  -- Classification
  post_type TEXT CHECK (post_type IN ('promotional', 'engagement', 'seasonal', 'educational')),
  event_reference TEXT,
  season_tag TEXT,

  -- AI scheduling suggestion
  suggested_date DATE,
  suggested_time TIME,
  ai_reasoning TEXT,

  -- Swipe decision
  decision TEXT DEFAULT 'pending' CHECK (decision IN ('pending', 'kept', 'skipped')),
  decided_at TIMESTAMPTZ,

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_candidates_plan ON autopilot_candidates(autopilot_plan_id);
CREATE INDEX idx_candidates_client ON autopilot_candidates(client_id);
CREATE INDEX idx_candidates_decision ON autopilot_candidates(autopilot_plan_id, decision);

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON autopilot_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE autopilot_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage candidates for their clients" ON autopilot_candidates
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- Content Preferences: training data from swipe decisions
CREATE TABLE content_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  media_gallery_id UUID REFERENCES media_gallery(id),
  caption TEXT NOT NULL,
  post_type TEXT,
  platforms TEXT[] DEFAULT '{}',
  event_context TEXT,
  season_context TEXT,

  liked BOOLEAN NOT NULL,

  caption_word_count INTEGER,
  hashtag_count INTEGER,
  emoji_count INTEGER,

  autopilot_plan_id UUID REFERENCES autopilot_plans(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_prefs_client ON content_preferences(client_id);
CREATE INDEX idx_content_prefs_liked ON content_preferences(client_id, liked);
CREATE INDEX idx_content_prefs_user ON content_preferences(user_id);

ALTER TABLE content_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own preferences" ON content_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Extend autopilot_plans for v2
ALTER TABLE autopilot_plans ADD COLUMN IF NOT EXISTS candidates_generated INTEGER DEFAULT 0;
ALTER TABLE autopilot_plans ADD COLUMN IF NOT EXISTS candidates_liked INTEGER DEFAULT 0;
ALTER TABLE autopilot_plans ADD COLUMN IF NOT EXISTS candidates_skipped INTEGER DEFAULT 0;
ALTER TABLE autopilot_plans ADD COLUMN IF NOT EXISTS generation_version TEXT DEFAULT 'v1';
