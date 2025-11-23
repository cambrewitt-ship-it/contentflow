-- Make project_id optional in client_approval_sessions table
-- This allows approval links to be created for posts without a project

-- First, update any existing sessions with null project_id to handle gracefully
-- (This shouldn't be necessary if table is empty, but good practice)

-- Remove NOT NULL constraint on project_id
ALTER TABLE client_approval_sessions 
ALTER COLUMN project_id DROP NOT NULL;

-- Update index to handle null values (existing index should work fine)
-- No changes needed to indexes as they already support null values

-- Optional: Add a comment to document the change
COMMENT ON COLUMN client_approval_sessions.project_id IS 'Optional project ID. If NULL, session applies to posts without a project for this client.';

