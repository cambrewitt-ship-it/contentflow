-- Create table to track when users last viewed each client's activity hub
-- This enables us to count "unread" notifications per client

CREATE TABLE IF NOT EXISTS client_activity_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user-client pair
  UNIQUE(user_id, client_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_views_user_id ON client_activity_views(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_views_client_id ON client_activity_views(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_views_last_viewed ON client_activity_views(last_viewed_at);

-- Enable Row Level Security (RLS)
ALTER TABLE client_activity_views ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own activity view records
CREATE POLICY "Users can view their own activity views" ON client_activity_views
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own activity view records
CREATE POLICY "Users can create their own activity views" ON client_activity_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own activity view records
CREATE POLICY "Users can update their own activity views" ON client_activity_views
  FOR UPDATE USING (auth.uid() = user_id);

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_activity_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_client_activity_views_updated_at_trigger
  BEFORE UPDATE ON client_activity_views
  FOR EACH ROW
  EXECUTE FUNCTION update_client_activity_views_updated_at();
