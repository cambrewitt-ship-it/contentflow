-- Tags Feature Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3B82F6', -- Hex color code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, name) -- Ensure unique tag names per client
);

-- 2. Create post_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS post_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, tag_id) -- Prevent duplicate tag assignments
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tags_client_id ON tags(client_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);

-- 4. Enable RLS on both tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for tags table
-- Users can view tags for their clients
CREATE POLICY "Users can view tags for accessible clients" ON tags
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create tags for their clients
CREATE POLICY "Users can create tags for accessible clients" ON tags
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can update tags for their clients
CREATE POLICY "Users can update tags for accessible clients" ON tags
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete tags for their clients
CREATE POLICY "Users can delete tags for accessible clients" ON tags
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- 6. RLS Policies for post_tags table
-- Users can view post_tags for posts they have access to
CREATE POLICY "Users can view post_tags for accessible posts" ON post_tags
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE user_id = auth.uid()
      )
    ) OR
    post_id IN (
      SELECT id FROM calendar_scheduled_posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can create post_tags for posts they have access to
CREATE POLICY "Users can create post_tags for accessible posts" ON post_tags
  FOR INSERT WITH CHECK (
    (
      post_id IN (
        SELECT id FROM posts 
        WHERE client_id IN (
          SELECT id FROM clients 
          WHERE user_id = auth.uid()
        )
      ) OR
      post_id IN (
        SELECT id FROM calendar_scheduled_posts 
        WHERE client_id IN (
          SELECT id FROM clients 
          WHERE user_id = auth.uid()
        )
      )
    ) AND
    tag_id IN (
      SELECT id FROM tags 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete post_tags for posts they have access to
CREATE POLICY "Users can delete post_tags for accessible posts" ON post_tags
  FOR DELETE USING (
    post_id IN (
      SELECT id FROM posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE user_id = auth.uid()
      )
    ) OR
    post_id IN (
      SELECT id FROM calendar_scheduled_posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE user_id = auth.uid()
      )
    )
  );

-- 7. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create trigger to auto-update updated_at on tags
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
