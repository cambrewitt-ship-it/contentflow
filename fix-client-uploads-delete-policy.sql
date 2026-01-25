-- Fix the DELETE policy for client_uploads
-- First drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can delete uploads for their clients" ON client_uploads;

-- Recreate the DELETE policy with correct syntax
CREATE POLICY "Users can delete uploads for their clients" ON client_uploads
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Verify the policy was created
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'client_uploads' AND cmd = 'DELETE';
