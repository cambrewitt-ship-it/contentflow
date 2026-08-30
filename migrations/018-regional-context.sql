-- Regional context: shared public-holiday calendar the autopilot agent can query
-- via the get_nz_context tool, instead of duplicating holiday data per-client
-- the way content_events (client_id NOT NULL) would require.
CREATE TABLE regional_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,           -- matches the lowercase region-matching convention in autopilot-engine.ts (e.g. 'new zealand')
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_recurring_annual BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_regional_holidays_region_date ON regional_holidays(region, holiday_date);

-- Public read (this is shared reference data, not tenant-scoped)
ALTER TABLE regional_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read regional holidays" ON regional_holidays
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: New Zealand public holidays.
--
-- IMPORTANT — VERIFY BEFORE RELYING ON THIS IN PRODUCTION:
-- Fixed-date holidays (New Year's, Waitangi Day, Anzac Day, Christmas, Boxing Day)
-- below use the literal statutory calendar date, not the Mondayised "observed"
-- date when a holiday falls on a weekend. Moveable holidays (Easter, King's
-- Birthday, Matariki, Labour Day) were computed by hand for this seed and are
-- best-effort, not sourced from an official calendar API. Cross-check against
-- https://www.govt.nz/browse/work/public-holidays-and-work/public-holidays-and-anniversary-dates/
-- before this feeds real client-facing content. 2027 intentionally omits the
-- moveable holidays (Easter/King's Birthday/Matariki/Labour Day) since accurately
-- hand-computing them a year+ out is error-prone — add them closer to the date.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO regional_holidays (region, holiday_date, name, is_recurring_annual) VALUES
  -- 2026
  ('new zealand', '2026-01-01', 'New Year''s Day', FALSE),
  ('new zealand', '2026-01-02', 'Day after New Year''s Day', FALSE),
  ('new zealand', '2026-02-06', 'Waitangi Day', FALSE),
  ('new zealand', '2026-04-03', 'Good Friday', FALSE),
  ('new zealand', '2026-04-06', 'Easter Monday', FALSE),
  ('new zealand', '2026-04-25', 'Anzac Day', FALSE),
  ('new zealand', '2026-06-01', 'King''s Birthday', FALSE),
  ('new zealand', '2026-07-10', 'Matariki', FALSE),
  ('new zealand', '2026-10-26', 'Labour Day', FALSE),
  ('new zealand', '2026-12-25', 'Christmas Day', FALSE),
  ('new zealand', '2026-12-26', 'Boxing Day', FALSE),
  -- 2027 (fixed-date holidays only — see note above)
  ('new zealand', '2027-01-01', 'New Year''s Day', FALSE),
  ('new zealand', '2027-01-02', 'Day after New Year''s Day', FALSE),
  ('new zealand', '2027-02-06', 'Waitangi Day', FALSE),
  ('new zealand', '2027-04-25', 'Anzac Day', FALSE),
  ('new zealand', '2027-12-25', 'Christmas Day', FALSE),
  ('new zealand', '2027-12-26', 'Boxing Day', FALSE);
