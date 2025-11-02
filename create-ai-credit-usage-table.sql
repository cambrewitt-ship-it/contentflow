-- Create ai_credit_usage table for tracking detailed analytics
-- This table logs every credit usage event for analytics purposes

CREATE TABLE IF NOT EXISTS ai_credit_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_type VARCHAR(50) NOT NULL CHECK (credit_type IN ('purchased', 'monthly')),
  action_type VARCHAR(100) NOT NULL, -- e.g., 'generate_captions', 'remix_caption', 'generate_content_ideas'
  credits_used INTEGER NOT NULL DEFAULT 1,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}', -- Additional metadata (action details, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_user_id ON ai_credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_created_at ON ai_credit_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_action_type ON ai_credit_usage(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_credit_type ON ai_credit_usage(credit_type);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_client_id ON ai_credit_usage(client_id);

-- Enable Row Level Security
ALTER TABLE ai_credit_usage ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only view their own credit usage
CREATE POLICY "Users can view own credit usage" ON ai_credit_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (for server-side logging)
-- Note: Service role bypasses RLS by default, so no explicit policy needed for inserts

-- Add comment for documentation
COMMENT ON TABLE ai_credit_usage IS 'Tracks detailed AI credit usage for analytics. Logs whether credits came from purchased or monthly allocation.';
COMMENT ON COLUMN ai_credit_usage.credit_type IS 'Type of credit used: purchased (from ai_credits_purchased) or monthly (from subscription monthly allocation)';
COMMENT ON COLUMN ai_credit_usage.action_type IS 'The action that used the credit (e.g., generate_captions, remix_caption)';
COMMENT ON COLUMN ai_credit_usage.metadata IS 'Additional metadata about the usage event (JSON object)';

