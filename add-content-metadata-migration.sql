-- Migration: Add content_metadata column to projects table
-- This migration adds a JSONB column to store content creation data

-- Add content_metadata column if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT '{}';

-- Create index on content_metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_content_metadata ON projects USING GIN (content_metadata);

-- Update existing projects to have empty content_metadata
UPDATE projects SET content_metadata = '{}' WHERE content_metadata IS NULL;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name = 'content_metadata';
