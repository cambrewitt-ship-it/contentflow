-- Add missing Do's & Don'ts columns to clients table
-- Run this in your Supabase SQL Editor

-- Add Do's & Don'ts columns for AI caption rules
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_dos TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_donts TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('caption_dos', 'caption_donts');
