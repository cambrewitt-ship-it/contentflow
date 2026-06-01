-- Migration 017: Post approval history
-- Tracks every change to approval_status and client_feedback so data is never truly lost.
-- The application writes a row here whenever a portal party submits feedback.

CREATE TABLE IF NOT EXISTS post_approval_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID        NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Who made the change (portal party name, or 'agency')
  changed_by    TEXT,
  -- Snapshot of values before and after
  previous_approval_status  TEXT,
  new_approval_status       TEXT,
  previous_client_feedback  TEXT,
  new_client_feedback       TEXT,
  -- Extra context (token prefix, party role, etc.)
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS post_approval_history_post_id_idx
  ON post_approval_history (post_id);

CREATE INDEX IF NOT EXISTS post_approval_history_changed_at_idx
  ON post_approval_history (changed_at DESC);
