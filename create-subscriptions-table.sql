-- Create subscriptions table for Stripe subscription management
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('starter', 'professional', 'agency', 'trial')),
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'incomplete_expired', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  -- Subscription limits based on tier
  max_clients INTEGER NOT NULL DEFAULT 1,
  max_posts_per_month INTEGER NOT NULL DEFAULT 30,
  max_ai_credits_per_month INTEGER NOT NULL DEFAULT 100,
  
  -- Usage tracking
  clients_used INTEGER DEFAULT 0,
  posts_used_this_month INTEGER DEFAULT 0,
  ai_credits_used_this_month INTEGER DEFAULT 0,
  usage_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(subscription_tier);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view and update their own subscription
CREATE POLICY "Users can view their own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for webhook updates)
CREATE POLICY "Service role can manage all subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Create function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE subscriptions
  SET 
    posts_used_this_month = 0,
    ai_credits_used_this_month = 0,
    usage_reset_date = NOW()
  WHERE usage_reset_date < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Create billing_history table for invoice tracking
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  amount_paid INTEGER NOT NULL, -- in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  invoice_pdf TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL,
  billing_reason TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for billing_history
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_customer_id ON billing_history(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON billing_history(created_at DESC);

-- Enable RLS for billing_history
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_history
CREATE POLICY "Users can view their own billing history" ON billing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all billing history" ON billing_history
  FOR ALL USING (auth.role() = 'service_role');

