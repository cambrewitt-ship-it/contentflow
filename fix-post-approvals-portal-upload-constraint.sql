-- Fix post_approvals check constraint to allow 'portal_upload' post_type
-- Portal uploads were silently failing to insert due to this missing value

ALTER TABLE post_approvals DROP CONSTRAINT IF EXISTS post_approvals_post_type_check;

ALTER TABLE post_approvals
  ADD CONSTRAINT post_approvals_post_type_check
  CHECK (post_type IN ('scheduled', 'planner_scheduled', 'portal_upload'));
