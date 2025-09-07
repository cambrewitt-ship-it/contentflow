-- Client approval sessions table
CREATE TABLE IF NOT EXISTS client_approval_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Post approvals table
CREATE TABLE IF NOT EXISTS post_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES client_approval_sessions(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  post_type VARCHAR(50) NOT NULL CHECK (post_type IN ('scheduled', 'planner_scheduled')),
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  client_comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes following your patterns
CREATE INDEX IF NOT EXISTS idx_client_approval_sessions_client_id ON client_approval_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_approval_sessions_project_id ON client_approval_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_client_approval_sessions_share_token ON client_approval_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_post_approvals_session_id ON post_approvals(session_id);
CREATE INDEX IF NOT EXISTS idx_post_approvals_post_id_type ON post_approvals(post_id, post_type);

-- RLS policies following your exact patterns
ALTER TABLE client_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_approvals ENABLE ROW LEVEL SECURITY;

-- Client approval sessions policies
CREATE POLICY "Users can view client_approval_sessions for accessible clients" ON client_approval_sessions
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = client_approval_sessions.client_id
    )
  );

CREATE POLICY "Users can create client_approval_sessions for accessible clients" ON client_approval_sessions
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = client_approval_sessions.client_id
    )
  );

-- Post approvals policies
CREATE POLICY "Users can view post_approvals for accessible sessions" ON post_approvals
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM client_approval_sessions 
      WHERE client_id IN (SELECT id FROM clients WHERE id = client_approval_sessions.client_id)
    )
  );

CREATE POLICY "Users can create post_approvals for accessible sessions" ON post_approvals
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM client_approval_sessions 
      WHERE client_id IN (SELECT id FROM clients WHERE id = client_approval_sessions.client_id)
    )
  );

CREATE POLICY "Users can update post_approvals for accessible sessions" ON post_approvals
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM client_approval_sessions 
      WHERE client_id IN (SELECT id FROM clients WHERE id = client_approval_sessions.client_id)
    )
  );

-- Auto-update triggers following your patterns
CREATE TRIGGER update_client_approval_sessions_updated_at 
  BEFORE UPDATE ON client_approval_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_approvals_updated_at 
  BEFORE UPDATE ON post_approvals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
