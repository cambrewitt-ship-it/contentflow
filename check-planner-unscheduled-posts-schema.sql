-- Check the current schema of planner_unscheduled_posts table
-- Run this first to see what columns already exist

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'planner_unscheduled_posts' 
ORDER BY ordinal_position;
