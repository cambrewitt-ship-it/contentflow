-- Media Gallery: persistent photo/video bank per client
CREATE TABLE media_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Media file
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  file_name TEXT,
  file_size INTEGER,
  thumbnail_url TEXT,

  -- AI Vision analysis (populated async after upload)
  ai_tags JSONB DEFAULT '[]'::jsonb,
  ai_description TEXT,
  ai_categories TEXT[] DEFAULT '{}',
  ai_mood TEXT,
  ai_setting TEXT,
  ai_subjects JSONB DEFAULT '[]'::jsonb,
  ai_analysis_status TEXT DEFAULT 'pending' CHECK (ai_analysis_status IN ('pending', 'analyzing', 'complete', 'failed')),
  ai_analysis_error TEXT,

  -- User-provided context
  user_tags TEXT[] DEFAULT '{}',
  user_context TEXT,
  user_category TEXT,

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  freshness_score FLOAT DEFAULT 1.0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'archived', 'cooling')),

  -- Metadata
  exif_data JSONB,
  captured_season TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_media_gallery_client ON media_gallery(client_id);
CREATE INDEX idx_media_gallery_user ON media_gallery(user_id);
CREATE INDEX idx_media_gallery_status ON media_gallery(client_id, status);
CREATE INDEX idx_media_gallery_freshness ON media_gallery(client_id, freshness_score DESC);
CREATE INDEX idx_media_gallery_analysis ON media_gallery(ai_analysis_status);
CREATE INDEX idx_media_gallery_ai_tags ON media_gallery USING GIN (ai_tags);
CREATE INDEX idx_media_gallery_categories ON media_gallery USING GIN (ai_categories);
CREATE INDEX idx_media_gallery_user_tags ON media_gallery USING GIN (user_tags);

-- Updated_at trigger
CREATE TRIGGER update_media_gallery_updated_at
  BEFORE UPDATE ON media_gallery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE media_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own gallery items" ON media_gallery
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view gallery for their clients" ON media_gallery
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
