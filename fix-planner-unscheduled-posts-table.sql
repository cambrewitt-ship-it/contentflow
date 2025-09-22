-- Fix planner_unscheduled_posts table
-- This script safely adds missing columns to the existing table

-- First, let's see what columns currently exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'planner_unscheduled_posts' 
ORDER BY ordinal_position;

-- Add missing columns one by one if they don't exist

-- Add project_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add client_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'client_id'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add caption column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'caption'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN caption TEXT;
    END IF;
END $$;

-- Add image_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Add post_notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'post_notes'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN post_notes TEXT DEFAULT '';
    END IF;
END $$;

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN status VARCHAR(50) DEFAULT 'draft';
    END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planner_unscheduled_posts' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE planner_unscheduled_posts 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add indexes for better performance (IF NOT EXISTS will prevent errors if they already exist)
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_id ON planner_unscheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_client_id ON planner_unscheduled_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_status ON planner_unscheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_created_at ON planner_unscheduled_posts(created_at);

-- Enable RLS if not already enabled
ALTER TABLE planner_unscheduled_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (DROP IF EXISTS first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view unscheduled posts for accessible clients" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can create unscheduled posts for accessible clients" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can update unscheduled posts for accessible clients" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can delete unscheduled posts for accessible clients" ON planner_unscheduled_posts;

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

-- Show final table structure
SELECT 'Final table structure:' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'planner_unscheduled_posts' 
ORDER BY ordinal_position;
