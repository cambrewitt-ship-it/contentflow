-- Add approval tracking fields to planner_scheduled_posts table
ALTER TABLE planner_scheduled_posts 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_attention'));

ALTER TABLE planner_scheduled_posts 
ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE;

ALTER TABLE planner_scheduled_posts 
ADD COLUMN IF NOT EXISTS client_feedback TEXT;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_approval_status 
ON planner_scheduled_posts(approval_status);

-- Add similar fields to scheduled_posts table for consistency
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_attention'));

ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE;

ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS client_feedback TEXT;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_approval_status 
ON scheduled_posts(approval_status);
