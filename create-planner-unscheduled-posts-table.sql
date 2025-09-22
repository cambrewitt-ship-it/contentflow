-- Create planner_unscheduled_posts table
-- This table stores posts that are created but not yet scheduled

-- First, check if table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS planner_unscheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  image_url TEXT,
  post_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled'));
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_id ON planner_unscheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_client_id ON planner_unscheduled_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_status ON planner_unscheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_created_at ON planner_unscheduled_posts(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE planner_unscheduled_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view unscheduled posts for accessible clients" ON planner_unscheduled_posts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = planner_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can create unscheduled posts for accessible clients" ON planner_unscheduled_posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = planner_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can update unscheduled posts for accessible clients" ON planner_unscheduled_posts
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = planner_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can delete unscheduled posts for accessible clients" ON planner_unscheduled_posts
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = planner_unscheduled_posts.client_id
    )
  );

-- Verify the table was created
SELECT 'planner_unscheduled_posts table created successfully' as status;
