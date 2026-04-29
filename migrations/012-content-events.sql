-- Content Events: three-tier event calendar for content planning
CREATE TABLE content_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_end_date DATE,
  event_time TIME,

  -- Classification
  event_type TEXT NOT NULL CHECK (event_type IN ('public_holiday', 'cultural', 'sports', 'industry', 'custom')),
  event_source TEXT NOT NULL DEFAULT 'user' CHECK (event_source IN ('system', 'suggested', 'user')),
  category TEXT,

  -- Content planning context
  relevance_tags TEXT[] DEFAULT '{}',
  content_angle TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT CHECK (recurrence_rule IN ('weekly', 'monthly', 'yearly')),
  recurrence_day TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  added_by TEXT DEFAULT 'user' CHECK (added_by IN ('system', 'ai_suggestion', 'user')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_content_events_client_date ON content_events(client_id, event_date);
CREATE INDEX idx_content_events_type ON content_events(client_id, event_type);
CREATE INDEX idx_content_events_active ON content_events(client_id, is_active);
CREATE INDEX idx_content_events_tags ON content_events USING GIN (relevance_tags);

-- Updated_at trigger
CREATE TRIGGER update_content_events_updated_at
  BEFORE UPDATE ON content_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage events for their clients" ON content_events
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
