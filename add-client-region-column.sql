-- Add region column to clients table for content idea generation
-- Region should be stored as a string (e.g., "New Zealand - Wellington", "New Zealand - Auckland", "USA - California", etc.)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS region VARCHAR(255);

-- Add a comment to explain the column
COMMENT ON COLUMN clients.region IS 'Client region for filtering regional holidays and localizing content suggestions (e.g., "New Zealand - Wellington", "USA - California")';

