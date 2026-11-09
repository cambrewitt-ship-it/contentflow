-- ============================================================
-- Migration 031: Brand kits for the Design Studio (image editor)
-- Safe to run multiple times.
--
-- One brand kit per client: logos, brand colours, heading/body fonts
-- (built-in or uploaded font files), and an uploads library of images
-- (stickers, product shots, badges) the agency reuses on designs.
-- Stored as JSONB so the kit can grow without more migrations; files
-- themselves live in the `media` storage bucket under brand-kits/.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_brand_kits (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  kit JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_brand_kits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_brand_kits' AND policyname = 'Users can manage brand kits for their clients'
  ) THEN
    CREATE POLICY "Users can manage brand kits for their clients" ON client_brand_kits
      FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;
