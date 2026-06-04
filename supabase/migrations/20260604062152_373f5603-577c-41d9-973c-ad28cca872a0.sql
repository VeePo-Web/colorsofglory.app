
REVOKE EXECUTE ON FUNCTION public._assert_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_founder(text,text,jsonb,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_founder_code(uuid,text,int,timestamptz,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_code(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_founder_summary() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_founder_detail(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_referrals_recent(int) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_monthly_payouts(date) FROM public, anon;
