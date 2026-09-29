-- ai_credit_usage was created in some environments without the metadata
-- column that trackAICreditUsage writes (per-run token counts, etc.).
ALTER TABLE ai_credit_usage ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
COMMENT ON COLUMN ai_credit_usage.metadata IS 'Additional metadata about the usage event (JSON object)';
