-- Setup Posts Table and Do's & Don'ts for Content Manager
-- Run this in your Supabase SQL Editor

-- 1. Add Do's & Don'ts columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_dos TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_donts TEXT;

-- 2. Create posts table for storing content suite posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  caption TEXT NOT NULL,
  image_url TEXT NOT NULL,
  media_type VARCHAR(50) DEFAULT 'image',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'published')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts(project_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- 4. Enable RLS on posts table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for posts table
CREATE POLICY "Users can view posts for accessible clients" ON posts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = posts.client_id
    )
  );

CREATE POLICY "Users can create posts for accessible clients" ON posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = posts.client_id
    )
  );

CREATE POLICY "Users can update posts for accessible clients" ON posts
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = posts.client_id
    )
  );

CREATE POLICY "Users can delete posts for accessible clients" ON posts
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = posts.client_id
    )
  );

-- 6. Verify the setup
SELECT 'Posts table created successfully' as status;
SELECT 'Do\'s & Don\'ts columns added to clients table' as status;
