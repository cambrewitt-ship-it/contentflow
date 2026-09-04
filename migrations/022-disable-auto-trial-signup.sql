-- ============================================================
-- Migration 022: Stop auto-creating free trial subscriptions for new signups
-- Safe to run multiple times (CREATE OR REPLACE is idempotent).
-- Does NOT touch any existing subscriptions rows.
--
-- New signups now go through Stripe Checkout with a 7-day trial
-- (card required up front); the subscriptions row is created by
-- checkout.session.completed / /api/stripe/callback once they complete
-- Checkout, not by this trigger. The auth.users trigger itself is left
-- in place — its exact name isn't tracked in this migrations folder (it
-- predates migration 001), so we neuter the function it calls instead,
-- which is safe regardless of the trigger's name.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_freemium_tier_to_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- No-op: new signups now get a subscriptions row via the Stripe
  -- checkout.session.completed webhook / /api/stripe/callback once they
  -- complete Checkout. auth.users inserts no longer auto-create a free
  -- trial/freemium placeholder row.
  RETURN NEW;
END;
$$;

-- Discovery query (read-only, informational) to confirm the trigger
-- exists and is bound to this function:
-- SELECT tgname, tgenabled, tgrelid::regclass
-- FROM pg_trigger
-- WHERE tgfoid = 'assign_freemium_tier_to_new_users()'::regprocedure;
