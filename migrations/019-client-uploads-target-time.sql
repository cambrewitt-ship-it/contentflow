-- Portal quick-add (Trello-style calendar) needs to schedule a client upload to a specific
-- time, not just a date. target_date already exists; this adds the matching time column.

ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS target_time TIME;
