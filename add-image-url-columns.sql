-- Migration: Add image_url column to posts tables
-- Date: 2024-12-19

-- Add image_url column to planner_unscheduled_posts table
ALTER TABLE planner_unscheduled_posts 
ADD COLUMN image_url TEXT;

-- Add image_url column to planner_scheduled_posts table
ALTER TABLE planner_scheduled_posts 
ADD COLUMN image_url TEXT;

-- Add image_url column to scheduled_posts table
ALTER TABLE scheduled_posts 
ADD COLUMN image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN planner_unscheduled_posts.image_url IS 'URL or path to the image associated with this post';
COMMENT ON COLUMN planner_scheduled_posts.image_url IS 'URL or path to the image associated with this post';
COMMENT ON COLUMN scheduled_posts.image_url IS 'URL or path to the image associated with this post';
