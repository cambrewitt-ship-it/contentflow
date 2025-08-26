-- Test what exists in your database
-- Run this in your Supabase SQL Editor

-- 1. Check if posts table exists
SELECT 
  table_name,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_name = 'posts';

-- 2. Check if caption_dos column exists in clients table
SELECT 
  column_name,
  data_type,
  'EXISTS' as status
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('caption_dos', 'caption_donts');

-- 3. Check clients table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY ordinal_position;
