
-- Clean up verification test data
DELETE FROM public.billing_events
  WHERE payload->'data'->'object'->>'id' LIKE 'sub_test_%'
     OR payload->'data'->'object'->>'subscription' = 'sub_test_pro'
     OR external_event_id LIKE 'evt_test_%';
DELETE FROM public.subscriptions WHERE external_id IN ('sub_test_pro','sub_test_founder');
DELETE FROM public.storage_addons WHERE external_id = 'sub_test_storage100';

-- Grant EXECUTE on effective_storage_limit so the SDK helper getEffectiveStorageLimit() works for authenticated users.
GRANT EXECUTE ON FUNCTION public.effective_storage_limit(uuid) TO authenticated;
