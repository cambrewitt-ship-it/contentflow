-- Add client logo column to the clients table
-- This allows clients to upload and store their logo URL

-- Add the logo_url column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add a comment to document the purpose of the column
COMMENT ON COLUMN clients.logo_url IS 'URL to the client logo image stored in blob storage';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_logo_url ON clients(logo_url);

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name = 'logo_url';
