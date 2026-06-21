-- ============================================================
-- Monthly payout-draft auto-creation via pg_cron (SQL = single source of truth)
--
-- WHY:
--   Maturation (`mature_holds`) is already scheduled in pg_cron
--   (job `cog-mature-holds-daily`, see 20260603202119). But the monthly
--   payout-DRAFT creation previously lived ONLY inside the
--   `rewards-mature-worker` edge function — and nothing in the repo invokes
--   that function. Automatic monthly payouts were therefore dependent on an
--   out-of-repo schedule that may not exist, so founders / user-referrers
--   could mature money to `payable` and never receive an auto-drafted payout.
--   This migration makes pg_cron the single, in-repo source of truth, exactly
--   mirroring how `mature_holds` is scheduled.
--
-- CORRECTNESS / SCALABILITY (improvement over the edge-worker logic):
--   The edge worker selected rewards by `created_at` within the *prior month*.
--   A reward created near month-end whose clawback hold matures AFTER that
--   month's run would be skipped that month, and excluded by `created_at` the
--   next month — orphaned as `payable` forever. This function instead sweeps
--   ALL matured (`payable`), un-batched (`payout_id IS NULL`), unpaid `cash`
--   rewards regardless of `created_at`, so late-maturing rewards are always
--   collected on the next monthly run. Nothing is ever orphaned.
--
-- IDEMPOTENCY:
--   `create_payout_batch` / `create_user_payout_batch` stamp `payout_id` on the
--   events they sweep and return NULL when the sum is 0. Re-running this
--   function (retry, redeploy, manual trigger) therefore collects nothing the
--   second time and creates no duplicate drafts. Safe to run any number of times
--   and safe to coexist with the `rewards-mature-worker` edge function if that
--   is ever also scheduled.
--
-- SECURITY:
--   SECURITY DEFINER, pinned search_path, EXECUTE revoked from anon/authenticated
--   and granted only to service_role. Drafts still require admin `approve_payout`
--   before any money moves. Every run writes an audit row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_monthly_payout_drafts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epoch          timestamptz := to_timestamp(0);  -- no created_at floor: sweep all matured money
  v_now            timestamptz := now();
  f                record;
  uid              uuid;
  pid              uuid;
  v_founder_drafts int := 0;
  v_user_drafts    int := 0;
BEGIN
  -- Founder referrers — only active founders earn payouts.
  FOR f IN SELECT id FROM public.founders WHERE status = 'active' LOOP
    pid := public.create_payout_batch(f.id, v_epoch, v_now);
    IF pid IS NOT NULL THEN v_founder_drafts := v_founder_drafts + 1; END IF;
  END LOOP;

  -- User referrers — anyone with matured, un-batched cash rewards outstanding.
  FOR uid IN
    SELECT DISTINCT referrer_user_id
      FROM public.reward_events
     WHERE status = 'payable'
       AND payout_id IS NULL
       AND reward_kind = 'cash'
       AND referrer_user_id IS NOT NULL
  LOOP
    pid := public.create_user_payout_batch(uid, v_epoch, v_now);
    IF pid IS NOT NULL THEN v_user_drafts := v_user_drafts + 1; END IF;
  END LOOP;

  PERFORM public.write_audit(
    NULL::uuid,
    'payout_drafts_created',
    'cron',
    NULL::uuid,
    NULL::jsonb,
    jsonb_build_object(
      'founder_drafts', v_founder_drafts,
      'user_drafts',    v_user_drafts,
      'run_at',         v_now
    ),
    NULL::text
  );

  RETURN jsonb_build_object('founder_drafts', v_founder_drafts, 'user_drafts', v_user_drafts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_monthly_payout_drafts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_monthly_payout_drafts() TO service_role;

-- ============================================================
-- Schedule: day-1 of each month at 07:25 UTC, just after
-- `cog-mature-holds-daily` (07:17) so the freshest payable rewards are included.
-- Idempotent re-run: unschedule any prior job of the same name first.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'cog-create-payout-drafts-monthly' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cog-create-payout-drafts-monthly',
  '25 7 1 * *',
  $cron$ SELECT public.create_monthly_payout_drafts(); $cron$
);
