-- Separate review feedback from copy/notes on client_uploads
-- Previously review comments were appended to the notes field, polluting the caption preview
ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS review_notes TEXT;
