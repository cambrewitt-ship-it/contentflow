-- Add timezone column to clients table for LATE API scheduling
-- Timezone should be stored as an IANA timezone string (e.g., "Pacific/Auckland", "America/New_York", "Europe/London")
-- This timezone will be used when scheduling posts via LATE API

ALTER TABLE clients ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Pacific/Auckland';

-- Add a comment to explain the column
COMMENT ON COLUMN clients.timezone IS 'IANA timezone string for scheduling posts (e.g., "Pacific/Auckland", "America/New_York", "Europe/London"). Used with LATE API for accurate post scheduling.';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_clients_timezone ON clients(timezone);

-- Verify the column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name = 'timezone';

