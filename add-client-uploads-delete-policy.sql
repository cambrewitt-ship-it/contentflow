-- Add missing DELETE policy for client_uploads table
-- This fixes the issue where client uploads cannot be deleted from the calendar

-- Create DELETE policy for client_uploads
CREATE POLICY "Users can delete uploads for their clients" ON client_uploads
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );
