-- Preserve the user-selected order of files within a carousel group.

ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS carousel_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_client_uploads_carousel_order
  ON client_uploads(carousel_group_id, carousel_order)
  WHERE carousel_group_id IS NOT NULL;
