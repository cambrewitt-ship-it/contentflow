-- Create projects table for client project management
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  content_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_content_metadata ON projects USING GIN (content_metadata);

-- Add RLS policies for projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view projects for clients they have access to
CREATE POLICY "Users can view projects for accessible clients" ON projects
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = projects.client_id
    )
  );

-- Policy: Users can create projects for clients they have access to
CREATE POLICY "Users can create projects for accessible clients" ON projects
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = projects.client_id
    )
  );

-- Policy: Users can update projects for clients they have access to
CREATE POLICY "Users can update projects for accessible clients" ON projects
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = projects.client_id
    )
  );

-- Policy: Users can delete projects for clients they have access to
CREATE POLICY "Users can delete projects for accessible clients" ON projects
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = projects.client_id
    )
  );

-- Update scheduled_posts table to use account_ids instead of platform
-- First, add the new account_ids column
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS account_ids JSONB DEFAULT '[]';

-- Create an index on account_ids for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_account_ids ON scheduled_posts USING GIN (account_ids);

-- Note: The platform column can be kept for backward compatibility or removed later
-- If you want to remove it, uncomment the following line:
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS platform;
