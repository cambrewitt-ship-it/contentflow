-- Add portal fields to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;

-- Generate portal tokens for existing clients that don't have them
UPDATE clients 
SET portal_token = gen_random_uuid()::text 
WHERE portal_token IS NULL;

-- Create client_uploads table for content inbox
CREATE TABLE IF NOT EXISTS client_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER DEFAULT 0,
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_uploads_client_id ON client_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_client_uploads_status ON client_uploads(status);
CREATE INDEX IF NOT EXISTS idx_client_uploads_created_at ON client_uploads(created_at);

-- Add RLS policies for client_uploads
ALTER TABLE client_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can only see their own uploads
CREATE POLICY "Clients can view their own uploads" ON client_uploads
  FOR SELECT USING (client_id = auth.uid()::text);

-- Policy: Clients can insert their own uploads
CREATE POLICY "Clients can insert their own uploads" ON client_uploads
  FOR INSERT WITH CHECK (client_id = auth.uid()::text);

-- Policy: Clients can update their own uploads
CREATE POLICY "Clients can update their own uploads" ON client_uploads
  FOR UPDATE USING (client_id = auth.uid()::text);

-- Policy: Service role can do everything (for API access)
CREATE POLICY "Service role full access" ON client_uploads
  FOR ALL USING (auth.role() = 'service_role');
