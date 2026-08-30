-- Paid ad copy: extends autopilot_candidates rather than a new table, since
-- plan linkage, decision/display_order, and RLS are all identical to organic
-- candidates — only the content shape differs. Deliberately does NOT route
-- through calendar_scheduled_posts (that table models "this gets published
-- via LATE," which ad copy never does) — approving an ad candidate just
-- flips ad_status, handled in the confirm route.

-- Same drop/recreate CHECK pattern already used safely in this codebase
-- (see client_uploads_status_check in migration 008).
ALTER TABLE autopilot_candidates DROP CONSTRAINT IF EXISTS autopilot_candidates_post_type_check;
ALTER TABLE autopilot_candidates ADD CONSTRAINT autopilot_candidates_post_type_check
  CHECK (post_type IN ('promotional', 'engagement', 'seasonal', 'educational', 'paid_ad'));

ALTER TABLE autopilot_candidates ADD COLUMN IF NOT EXISTS ad_headline TEXT;
ALTER TABLE autopilot_candidates ADD COLUMN IF NOT EXISTS ad_primary_text TEXT;
ALTER TABLE autopilot_candidates ADD COLUMN IF NOT EXISTS ad_description TEXT;
ALTER TABLE autopilot_candidates ADD COLUMN IF NOT EXISTS ad_platform TEXT CHECK (ad_platform IN ('meta', 'google'));
ALTER TABLE autopilot_candidates ADD COLUMN IF NOT EXISTS ad_status TEXT CHECK (ad_status IN ('pending', 'ready', 'copied'));

-- Per-client toggle + settings for ad copy generation, same JSONB-settings-column
-- pattern as posting_preferences / business_context / autopilot_settings.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ad_copy_settings JSONB DEFAULT '{"enabled": false, "platform": "meta", "variants_per_run": 3}'::jsonb;
