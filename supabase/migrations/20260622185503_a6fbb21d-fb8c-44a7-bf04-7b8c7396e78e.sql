CREATE OR REPLACE FUNCTION public.create_monthly_payout_drafts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epoch          timestamptz := to_timestamp(0);
  v_now            timestamptz := now();
  f                record;
  uid              uuid;
  pid              uuid;
  v_founder_drafts int := 0;
  v_user_drafts    int := 0;
BEGIN
  FOR f IN SELECT id FROM public.founders WHERE status = 'active' LOOP
    pid := public.create_payout_batch(f.id, v_epoch, v_now);
    IF pid IS NOT NULL THEN v_founder_drafts := v_founder_drafts + 1; END IF;
  END LOOP;

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