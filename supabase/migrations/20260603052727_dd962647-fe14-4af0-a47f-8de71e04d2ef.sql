
-- Revoke EXECUTE from anon/authenticated on sensitive financial helpers.
-- These should only be called from edge functions running with the service role.
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid,text,text,uuid,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attribute_referral(uuid,text,public.attribution_source) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_code(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_paid_month_index(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_invoice_paid(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_invoice_refunded(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_chargeback(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mature_holds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_credit_to_invoice(uuid,text,int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_payout_batch(uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_payout(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_payout_paid(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_payout_failed(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_override_attribution(uuid,public.referrer_type,uuid,text) FROM PUBLIC, anon, authenticated;

-- Seed pricing and reward settings (idempotent)
INSERT INTO public.app_settings(key, value, description) VALUES
  ('pro_price_cents', to_jsonb(10000), 'Public Pro plan price in cents'),
  ('founder_price_cents', to_jsonb(5000), 'Founder-rate Pro price in cents'),
  ('founder_reward_first6_cents', to_jsonb(2000), 'Founder cash reward for first 6 paid months (cents)'),
  ('founder_reward_ongoing_cents', to_jsonb(1000), 'Founder cash reward after month 6 (cents)'),
  ('user_credit_cents', to_jsonb(1000), 'Service credit per active paid referral (cents)'),
  ('reward_hold_days', to_jsonb(30), 'Days a reward is held pending before maturing')
ON CONFLICT (key) DO NOTHING;
