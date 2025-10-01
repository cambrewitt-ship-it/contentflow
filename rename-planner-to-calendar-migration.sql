-- Migration: Rename Planner Tables to Calendar
-- This migration renames all planner-related tables to calendar-related tables
-- Run this in your Supabase SQL Editor

-- 1. Rename planner_unscheduled_posts to calendar_unscheduled_posts
ALTER TABLE planner_unscheduled_posts RENAME TO calendar_unscheduled_posts;

-- 2. Rename planner_scheduled_posts to calendar_scheduled_posts  
ALTER TABLE planner_scheduled_posts RENAME TO calendar_scheduled_posts;

-- 3. Update all indexes to use new table names
-- Drop old indexes
DROP INDEX IF EXISTS idx_planner_unscheduled_posts_project_id;
DROP INDEX IF EXISTS idx_planner_unscheduled_posts_client_id;
DROP INDEX IF EXISTS idx_planner_unscheduled_posts_status;
DROP INDEX IF EXISTS idx_planner_unscheduled_posts_created_at;

DROP INDEX IF EXISTS idx_planner_scheduled_posts_project_date_time;
DROP INDEX IF EXISTS idx_planner_scheduled_posts_client_id;
DROP INDEX IF EXISTS idx_planner_scheduled_posts_late_status;
DROP INDEX IF EXISTS idx_planner_scheduled_posts_confirmed;
DROP INDEX IF EXISTS idx_planner_scheduled_posts_created_at;
DROP INDEX IF EXISTS idx_planner_scheduled_posts_updated_at;

-- Create new indexes with calendar table names
CREATE INDEX IF NOT EXISTS idx_calendar_unscheduled_posts_project_id ON calendar_unscheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_unscheduled_posts_client_id ON calendar_unscheduled_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_unscheduled_posts_approval_status ON calendar_unscheduled_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_calendar_unscheduled_posts_created_at ON calendar_unscheduled_posts(created_at);

CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_posts_project_date_time ON calendar_scheduled_posts(project_id, scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_posts_client_id ON calendar_scheduled_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_posts_late_status ON calendar_scheduled_posts(late_status);
CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_posts_created_at ON calendar_scheduled_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_posts_updated_at ON calendar_scheduled_posts(updated_at DESC);

-- 4. Update RLS policies to use new table names
-- Drop old policies
DROP POLICY IF EXISTS "Users can view unscheduled posts for accessible clients" ON calendar_unscheduled_posts;
DROP POLICY IF EXISTS "Users can create unscheduled posts for accessible clients" ON calendar_unscheduled_posts;
DROP POLICY IF EXISTS "Users can update unscheduled posts for accessible clients" ON calendar_unscheduled_posts;
DROP POLICY IF EXISTS "Users can delete unscheduled posts for accessible clients" ON calendar_unscheduled_posts;

-- Create new policies with calendar table names
CREATE POLICY "Users can view unscheduled posts for accessible clients" ON calendar_unscheduled_posts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = calendar_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can create unscheduled posts for accessible clients" ON calendar_unscheduled_posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = calendar_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can update unscheduled posts for accessible clients" ON calendar_unscheduled_posts
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = calendar_unscheduled_posts.client_id
    )
  );

CREATE POLICY "Users can delete unscheduled posts for accessible clients" ON calendar_unscheduled_posts
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = calendar_unscheduled_posts.client_id
    )
  );

-- 5. Update table statistics
ANALYZE calendar_unscheduled_posts;
ANALYZE calendar_scheduled_posts;

-- 6. Verify the migration
SELECT 'Migration completed successfully' as status;
SELECT 'calendar_unscheduled_posts' as table_name, count(*) as row_count FROM calendar_unscheduled_posts
UNION ALL
SELECT 'calendar_scheduled_posts' as table_name, count(*) as row_count FROM calendar_scheduled_posts;
