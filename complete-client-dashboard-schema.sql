-- Complete Client Dashboard Schema Update
-- This file ensures all fields used in the client dashboard are present in the database

-- 1. Add missing brand_voice_examples column (the one we just added to the code)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_voice_examples TEXT;

-- 2. Ensure all brand information fields are present
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_tone VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_dos TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_donts TEXT;

-- 3. Add any other fields that might be missing from the Client interface
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_keywords TEXT[];
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_guidelines_summary TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS core_products_services TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS founded_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS late_profile_id VARCHAR(255);

-- 4. Add comments to document the purpose of each column
COMMENT ON COLUMN clients.brand_voice_examples IS 'Text examples of brand voice from website content, social media posts, or brand documents to guide AI caption generation';
COMMENT ON COLUMN clients.company_description IS 'Detailed description of the company, mission, and values';
COMMENT ON COLUMN clients.website_url IS 'Client website URL for scraping and analysis';
COMMENT ON COLUMN clients.brand_tone IS 'Brand tone (e.g., professional, casual, luxury, friendly)';
COMMENT ON COLUMN clients.target_audience IS 'Description of the target audience for content creation';
COMMENT ON COLUMN clients.value_proposition IS 'Unique selling point or main benefit of the company';
COMMENT ON COLUMN clients.caption_dos IS 'AI caption generation rules - what to always include';
COMMENT ON COLUMN clients.caption_donts IS 'AI caption generation rules - what to never include';
COMMENT ON COLUMN clients.industry IS 'Industry category for the client';
COMMENT ON COLUMN clients.brand_keywords IS 'Array of brand-relevant keywords for content generation';
COMMENT ON COLUMN clients.brand_guidelines_summary IS 'Summary of brand guidelines and style preferences';
COMMENT ON COLUMN clients.core_products_services IS 'Core products or services offered by the client';
COMMENT ON COLUMN clients.founded_date IS 'Date the company was founded';
COMMENT ON COLUMN clients.late_profile_id IS 'LATE API profile ID for social media scheduling';

-- 5. Create indexes for better query performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_clients_brand_tone ON clients(brand_tone);
CREATE INDEX IF NOT EXISTS idx_clients_industry ON clients(industry);
CREATE INDEX IF NOT EXISTS idx_clients_late_profile_id ON clients(late_profile_id);

-- 6. Create a GIN index for brand_keywords array searches
CREATE INDEX IF NOT EXISTS idx_clients_brand_keywords ON clients USING GIN(brand_keywords);

-- 7. Verify all columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN (
    'brand_voice_examples',
    'company_description', 
    'website_url', 
    'brand_tone', 
    'target_audience', 
    'value_proposition', 
    'caption_dos', 
    'caption_donts',
    'industry',
    'brand_keywords',
    'brand_guidelines_summary',
    'core_products_services',
    'founded_date',
    'late_profile_id'
)
ORDER BY column_name;
