
GRANT EXECUTE ON FUNCTION public.approve_payout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payout_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payout_failed(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_attribution(uuid, public.referrer_type, uuid, text) TO authenticated;
