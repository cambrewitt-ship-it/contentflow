-- Make media gallery deletion safe by nullifying dependent references
-- This prevents foreign key constraint failures when a media item is permanently deleted.

ALTER TABLE autopilot_candidates
  DROP CONSTRAINT IF EXISTS autopilot_candidates_media_gallery_id_fkey;

ALTER TABLE autopilot_candidates
  ADD CONSTRAINT autopilot_candidates_media_gallery_id_fkey
  FOREIGN KEY (media_gallery_id)
  REFERENCES media_gallery(id)
  ON DELETE SET NULL;

ALTER TABLE content_preferences
  DROP CONSTRAINT IF EXISTS content_preferences_media_gallery_id_fkey;

ALTER TABLE content_preferences
  ADD CONSTRAINT content_preferences_media_gallery_id_fkey
  FOREIGN KEY (media_gallery_id)
  REFERENCES media_gallery(id)
  ON DELETE SET NULL;
