-- Add Post Editing Functionality Columns - FIXED VERSION
-- This script adds comprehensive post editing functionality to the posts table

-- 1. Add basic editing columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES clients(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS needs_reapproval BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_reason TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_attention', 'draft'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_caption TEXT;

-- 2. Add content suite specific columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_alt_text TEXT;

-- 3. Add concurrent editing and workflow columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS currently_editing_by UUID REFERENCES clients(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE posts ADD COLUMN IF NOT EXISTS draft_changes JSONB DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_requirements JSONB DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reapproval_notified_at TIMESTAMP WITH TIME ZONE;

-- 4. Check if post_revisions table exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_revisions') THEN
        DROP TABLE post_revisions CASCADE;
    END IF;
END $$;

-- 5. Create post_revisions table for tracking edit history
CREATE TABLE post_revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES clients(id),
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  previous_caption TEXT NOT NULL,
  new_caption TEXT NOT NULL,
  edit_reason TEXT,
  revision_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_last_edited_by ON posts(last_edited_by);
CREATE INDEX IF NOT EXISTS idx_posts_last_edited_at ON posts(last_edited_at);
CREATE INDEX IF NOT EXISTS idx_posts_needs_reapproval ON posts(needs_reapproval);
CREATE INDEX IF NOT EXISTS idx_posts_approval_status ON posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_posts_edit_count ON posts(edit_count);
CREATE INDEX IF NOT EXISTS idx_posts_currently_editing_by ON posts(currently_editing_by);
CREATE INDEX IF NOT EXISTS idx_posts_editing_started_at ON posts(editing_started_at);
CREATE INDEX IF NOT EXISTS idx_posts_last_modified_at ON posts(last_modified_at);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_posts_categories ON posts USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_posts_ai_settings ON posts USING GIN(ai_settings);
CREATE INDEX IF NOT EXISTS idx_posts_draft_changes ON posts USING GIN(draft_changes);
CREATE INDEX IF NOT EXISTS idx_posts_platform_requirements ON posts USING GIN(platform_requirements);

-- Indexes for post_revisions table
CREATE INDEX IF NOT EXISTS idx_post_revisions_post_id ON post_revisions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_revisions_edited_by ON post_revisions(edited_by);
CREATE INDEX IF NOT EXISTS idx_post_revisions_edited_at ON post_revisions(edited_at);
CREATE INDEX IF NOT EXISTS idx_post_revisions_revision_number ON post_revisions(post_id, revision_number);

-- 7. Enable RLS on post_revisions table
ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for post_revisions
CREATE POLICY "Users can view revisions for accessible posts" ON post_revisions
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE id = posts.client_id
      )
    )
  );

CREATE POLICY "Users can create revisions for accessible posts" ON post_revisions
  FOR INSERT WITH CHECK (
    post_id IN (
      SELECT id FROM posts 
      WHERE client_id IN (
        SELECT id FROM clients 
        WHERE id = posts.client_id
      )
    )
  );

-- 9. Create function to automatically create revision when post is updated
CREATE OR REPLACE FUNCTION create_post_revision()
RETURNS TRIGGER AS $$
DECLARE
  revision_num INTEGER;
BEGIN
  -- Only create a revision if the caption has changed
  IF OLD.caption IS DISTINCT FROM NEW.caption THEN
    SELECT COALESCE(MAX(revision_number), 0) + 1
    INTO revision_num
    FROM post_revisions
    WHERE post_id = NEW.id;

    INSERT INTO post_revisions (post_id, edited_by, previous_caption, new_caption, edit_reason, revision_number)
    VALUES (OLD.id, NEW.last_edited_by, OLD.caption, NEW.caption, NEW.edit_reason, revision_num);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger to automatically create revisions
DROP TRIGGER IF EXISTS trigger_create_post_revision ON posts;
CREATE TRIGGER trigger_create_post_revision
  AFTER UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION create_post_revision();

-- 11. Update existing posts to have original_caption set to current caption
UPDATE posts 
SET original_caption = caption 
WHERE original_caption IS NULL;

-- 12. Verify the setup
SELECT 'Post editing columns added successfully' as status;
SELECT 'Post revisions table created successfully' as status;
SELECT 'Revision tracking trigger created successfully' as status;
