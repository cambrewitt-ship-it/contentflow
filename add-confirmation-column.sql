-- Add is_confirmed column to planner_scheduled_posts table
ALTER TABLE planner_scheduled_posts 
ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE;

-- Add index for better performance on confirmation queries
CREATE INDEX idx_planner_scheduled_posts_confirmed ON planner_scheduled_posts(is_confirmed);

-- Update existing posts to have is_confirmed = false
UPDATE planner_scheduled_posts 
SET is_confirmed = FALSE 
WHERE is_confirmed IS NULL;
