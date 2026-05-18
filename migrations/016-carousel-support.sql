-- Carousel support: group multiple uploads into a single post,
-- and allow posts to carry multiple media URLs.

-- 1. Group uploaded files into a carousel via a shared UUID
ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS carousel_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_client_uploads_carousel_group
  ON client_uploads(carousel_group_id)
  WHERE carousel_group_id IS NOT NULL;

-- 2. Allow posts/calendar rows to store an ordered list of media URLs
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_urls TEXT[];

ALTER TABLE calendar_unscheduled_posts
  ADD COLUMN IF NOT EXISTS media_urls TEXT[];

ALTER TABLE calendar_scheduled_posts
  ADD COLUMN IF NOT EXISTS media_urls TEXT[];
