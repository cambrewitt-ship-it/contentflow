-- ============================================================
-- Migration 030: email_log — audit + de-duplication for outgoing email
-- Safe to run multiple times.
--
-- Every lifecycle/billing email (welcome, trial ending, payment failed,
-- etc.) claims a unique dedupe_key here before sending, so Stripe webhook
-- retries or a confirmation link clicked twice never send a duplicate.
-- Only the server (service role) reads/writes this table; RLS is enabled
-- with no policies so it's invisible to the anon/authenticated roles.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type  TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  dedupe_key  TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sent', 'failed')),
  resend_id   TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON public.email_log (user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type_created ON public.email_log (email_type, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_log IS 'Outgoing transactional email log; dedupe_key prevents duplicate sends. Service role only.';
