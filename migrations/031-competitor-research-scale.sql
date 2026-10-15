-- ============================================================
-- Migration 031: Competitor research — shared cache, rate-limit
-- queue and data retention. Run after 030. Safe to run multiple times.
--
-- competitor_account_cache  public posts/profile for an Instagram or TikTok
--                           account, shared by every client tracking it, so
--                           one fetch a day serves them all. Server-only.
-- research_api_usage        last known Meta rate-limit usage, so runs queue
--                           before hitting the limit instead of failing.
-- competitor_research_reports gains a 'queued' status for runs waiting on
--                           the rate limit, started_at and raw_data_purged_at.
-- purge_competitor_research_data() strips competitor post content from
--                           reports older than the retention window and
--                           clears old cache rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS competitor_account_cache (
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  handle TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_competitor_cache_fetched ON competitor_account_cache(fetched_at);

-- RLS on with no policies: only the service role (server) can read or write.
ALTER TABLE competitor_account_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS research_api_usage (
  provider TEXT PRIMARY KEY,
  usage_pct INTEGER NOT NULL DEFAULT 0,
  regain_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE research_api_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE competitor_research_reports
  DROP CONSTRAINT IF EXISTS competitor_research_reports_status_check;
ALTER TABLE competitor_research_reports
  ADD CONSTRAINT competitor_research_reports_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'failed'));

ALTER TABLE competitor_research_reports
  ADD COLUMN IF NOT EXISTS queued_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  -- When the run actually started (queued runs start after created_at)
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_data_purged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_research_reports_queued
  ON competitor_research_reports(queued_until)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_research_reports_unpurged
  ON competitor_research_reports(created_at)
  WHERE raw_data_purged_at IS NULL;

-- Keeps the insights and metrics; removes competitors' captions, image links,
-- post links and hashtags from reports older than retention_days.
CREATE OR REPLACE FUNCTION purge_competitor_research_data(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged INTEGER;
BEGIN
  UPDATE competitor_research_reports
  SET report = jsonb_set(
        report,
        '{posts}',
        COALESCE(
          (SELECT jsonb_agg(p - 'caption' - 'image_url' - 'url' - 'hashtags')
           FROM jsonb_array_elements(report->'posts') AS p),
          '[]'::jsonb
        )
      ),
      raw_data_purged_at = now()
  WHERE raw_data_purged_at IS NULL
    AND report IS NOT NULL
    AND jsonb_typeof(report->'posts') = 'array'
    AND created_at < now() - make_interval(days => retention_days);
  GET DIAGNOSTICS purged = ROW_COUNT;

  DELETE FROM competitor_account_cache WHERE fetched_at < now() - interval '7 days';

  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION purge_competitor_research_data(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_competitor_research_data(INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_competitor_research_data(INTEGER) TO service_role;
