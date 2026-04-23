-- Performance indexes for portal loading
-- client_uploads: index on client_id (used in every inbox/upload fetch)
CREATE INDEX IF NOT EXISTS idx_client_uploads_client_id ON client_uploads(client_id);
-- Composite index covers the common inbox filter: client + status + ordering
CREATE INDEX IF NOT EXISTS idx_client_uploads_client_status ON client_uploads(client_id, status, created_at DESC);

-- calendar_scheduled_posts: index on client_id (used in every calendar fetch)
CREATE INDEX IF NOT EXISTS idx_calendar_posts_client_id ON calendar_scheduled_posts(client_id);
-- Composite index covers the date-range query pattern
CREATE INDEX IF NOT EXISTS idx_calendar_posts_client_date ON calendar_scheduled_posts(client_id, scheduled_date);
