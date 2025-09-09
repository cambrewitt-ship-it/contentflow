-- Add brand_voice_examples column to clients table
-- This column will store text examples of the brand's voice for AI caption generation

ALTER TABLE clients 
ADD COLUMN brand_voice_examples TEXT;

-- Add a comment to describe the column purpose
COMMENT ON COLUMN clients.brand_voice_examples IS 'Text examples of brand voice from website content, social media posts, or brand documents to guide AI caption generation';

-- Update the column to allow NULL values (it's optional)
ALTER TABLE clients 
ALTER COLUMN brand_voice_examples SET DEFAULT NULL;

-- Create an index for better query performance if needed
-- CREATE INDEX IF NOT EXISTS idx_clients_brand_voice_examples ON clients USING gin(to_tsvector('english', brand_voice_examples));
