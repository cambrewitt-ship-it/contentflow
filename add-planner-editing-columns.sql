-- Add Post Editing Functionality Columns to Planner Tables
-- Run this in your Supabase SQL Editor

-- 1. Add new columns to planner_scheduled_posts table for editing functionality
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES clients(id);
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS needs_reapproval BOOLEAN DEFAULT FALSE;
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS edit_reason TEXT;
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_attention'));
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS original_caption TEXT;

-- 2. Add new columns to planner_unscheduled_posts table for editing functionality
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES clients(id);
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS needs_reapproval BOOLEAN DEFAULT FALSE;
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS edit_reason TEXT;
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_attention'));
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS original_caption TEXT;

-- 3. Add content suite specific columns to planner tables
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}';
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS media_alt_text TEXT;

ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}';
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS media_alt_text TEXT;

-- 4. Add concurrent editing and workflow columns to planner tables
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS currently_editing_by UUID REFERENCES clients(id);
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS editing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS draft_changes JSONB DEFAULT '{}';
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS platform_requirements JSONB DEFAULT '{}';
ALTER TABLE planner_scheduled_posts ADD COLUMN IF NOT EXISTS reapproval_notified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS currently_editing_by UUID REFERENCES clients(id);
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS editing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS draft_changes JSONB DEFAULT '{}';
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS platform_requirements JSONB DEFAULT '{}';
ALTER TABLE planner_unscheduled_posts ADD COLUMN IF NOT EXISTS reapproval_notified_at TIMESTAMP WITH TIME ZONE;

-- 5. Add indexes for better performance on planner tables
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_last_edited_by ON planner_scheduled_posts(last_edited_by);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_last_edited_at ON planner_scheduled_posts(last_edited_at);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_needs_reapproval ON planner_scheduled_posts(needs_reapproval);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_approval_status ON planner_scheduled_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_currently_editing_by ON planner_scheduled_posts(currently_editing_by);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_editing_started_at ON planner_scheduled_posts(editing_started_at);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_last_modified_at ON planner_scheduled_posts(last_modified_at);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_tags ON planner_scheduled_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_categories ON planner_scheduled_posts USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_ai_settings ON planner_scheduled_posts USING GIN(ai_settings);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_draft_changes ON planner_scheduled_posts USING GIN(draft_changes);
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_platform_requirements ON planner_scheduled_posts USING GIN(platform_requirements);

CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_last_edited_by ON planner_unscheduled_posts(last_edited_by);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_last_edited_at ON planner_unscheduled_posts(last_edited_at);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_needs_reapproval ON planner_unscheduled_posts(needs_reapproval);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_approval_status ON planner_unscheduled_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_currently_editing_by ON planner_unscheduled_posts(currently_editing_by);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_editing_started_at ON planner_unscheduled_posts(editing_started_at);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_last_modified_at ON planner_unscheduled_posts(last_modified_at);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_tags ON planner_unscheduled_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_categories ON planner_unscheduled_posts USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_ai_settings ON planner_unscheduled_posts USING GIN(ai_settings);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_draft_changes ON planner_unscheduled_posts USING GIN(draft_changes);
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_platform_requirements ON planner_unscheduled_posts USING GIN(platform_requirements);

-- 6. Update existing posts to have original_caption set to current caption
UPDATE planner_scheduled_posts 
SET original_caption = caption 
WHERE original_caption IS NULL;

UPDATE planner_unscheduled_posts 
SET original_caption = caption 
WHERE original_caption IS NULL;

-- 7. Verify the setup
SELECT 'Planner editing columns added successfully' as status;
SELECT 'Planner scheduled posts columns updated' as status;
SELECT 'Planner unscheduled posts columns updated' as status;
