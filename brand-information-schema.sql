-- Brand Information System Database Schema
-- This file adds brand-related functionality to the existing ContentFlow v2 database

-- 1. Enhance the existing clients table with brand information fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_tone VARCHAR(100); -- e.g., 'professional', 'casual', 'luxury'
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_keywords TEXT[]; -- Array of brand-relevant keywords
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_guidelines_summary TEXT;

-- Add Do's & Don'ts columns for AI caption rules
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_dos TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS caption_donts TEXT;

-- 2. Create brand_documents table for storing uploaded brand materials
CREATE TABLE IF NOT EXISTS brand_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- 'pdf', 'docx', 'doc', 'txt'
  file_size INTEGER NOT NULL, -- in bytes
  file_path VARCHAR(500) NOT NULL, -- storage path
  extracted_text TEXT, -- processed text content
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create website_scrapes table for storing scraped website content
CREATE TABLE IF NOT EXISTS website_scrapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  scraped_content TEXT,
  meta_description TEXT,
  page_title VARCHAR(500),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scrape_status VARCHAR(50) DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'completed', 'failed')),
  scrape_error TEXT
);

-- 4. Create brand_insights table for AI-generated brand analysis
CREATE TABLE IF NOT EXISTS brand_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  insight_type VARCHAR(100) NOT NULL, -- 'tone_analysis', 'keyword_extraction', 'brand_summary'
  content TEXT NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_documents UUID[], -- Array of brand_document IDs that contributed
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_brand_documents_client_id ON brand_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_documents_file_type ON brand_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_brand_documents_processing_status ON brand_documents(processing_status);

CREATE INDEX IF NOT EXISTS idx_website_scrapes_client_id ON website_scrapes(client_id);
CREATE INDEX IF NOT EXISTS idx_website_scrapes_scrape_status ON website_scrapes(scrape_status);

CREATE INDEX IF NOT EXISTS idx_brand_insights_client_id ON brand_insights(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_insights_insight_type ON brand_insights(insight_type);

-- 6. Enable Row Level Security (RLS) on new tables
ALTER TABLE brand_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_scrapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_insights ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for brand_documents
CREATE POLICY "Users can view brand documents for accessible clients" ON brand_documents
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_documents.client_id
    )
  );

CREATE POLICY "Users can create brand documents for accessible clients" ON brand_documents
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_documents.client_id
    )
  );

CREATE POLICY "Users can update brand documents for accessible clients" ON brand_documents
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_documents.client_id
    )
  );

CREATE POLICY "Users can delete brand documents for accessible clients" ON brand_documents
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_documents.client_id
    )
  );

-- 8. RLS Policies for website_scrapes
CREATE POLICY "Users can view website scrapes for accessible clients" ON website_scrapes
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = website_scrapes.client_id
    )
  );

CREATE POLICY "Users can create website scrapes for accessible clients" ON website_scrapes
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = website_scrapes.client_id
    )
  );

-- 9. RLS Policies for brand_insights
CREATE POLICY "Users can view brand insights for accessible clients" ON brand_insights
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_insights.client_id
    )
  );

CREATE POLICY "Users can create brand insights for accessible clients" ON brand_insights
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = brand_insights.client_id
    )
  );

-- 10. Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brand_documents_updated_at 
  BEFORE UPDATE ON brand_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Add sample data for testing (optional)
-- INSERT INTO clients (name, company_description, website_url, brand_tone, target_audience, industry)
-- VALUES (
--   'Sample Client',
--   'A forward-thinking company focused on innovation and customer success.',
--   'https://example.com',
--   'professional',
--   'Business professionals and decision makers',
--   'Technology'
-- );
