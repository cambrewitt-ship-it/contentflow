-- Create unscheduled_posts table
CREATE TABLE IF NOT EXISTS unscheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  post_data JSONB NOT NULL, -- Contains images, captions, notes, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  unscheduled_post_id UUID REFERENCES unscheduled_posts(id) ON DELETE CASCADE,
  post_data JSONB NOT NULL, -- Copy of the post data
  scheduled_date DATE NOT NULL,
  scheduled_time TIME, -- Optional time for the post
  week_index INTEGER NOT NULL, -- Which week (0-3 for 4-week view)
  day_index INTEGER NOT NULL, -- Which day (0-6 for Monday-Sunday)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_unscheduled_posts_project_id ON unscheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_project_id ON scheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_date ON scheduled_posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_week_day ON scheduled_posts(week_index, day_index);

-- Add RLS policies if needed
ALTER TABLE unscheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
