-- ============================================================
-- Migration 032: Caption library (accounts to @tag, hashtag sets)
-- Safe to run multiple times.
--
-- One row per client: the Instagram/Facebook accounts the client tags
-- and their saved hashtag sets, used by the @ and # autocomplete in
-- caption boxes. Stored as JSONB like client_brand_kits.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_caption_libraries (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  hashtag_sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_caption_libraries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_caption_libraries' AND policyname = 'Users can manage caption libraries for their clients'
  ) THEN
    CREATE POLICY "Users can manage caption libraries for their clients" ON client_caption_libraries
      FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;
