-- Update RLS Policies for post_tags table to support calendar_scheduled_posts
-- Run this if you've already created the tables but need to fix the RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view post_tags for accessible posts" ON post_tags;
DROP POLICY IF EXISTS "Users can create post_tags for accessible posts" ON post_tags;
DROP POLICY IF EXISTS "Users can delete post_tags for accessible posts" ON post_tags;

-- Recreate policies that check both posts and calendar_scheduled_posts tables
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
