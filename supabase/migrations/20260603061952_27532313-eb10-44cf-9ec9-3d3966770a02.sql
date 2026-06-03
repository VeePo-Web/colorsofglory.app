DELETE FROM billing_events WHERE (payload->'data'->'object'->'metadata'->>'userId')='11111111-2222-3333-4444-555555555501';
DELETE FROM subscriptions WHERE user_id='11111111-2222-3333-4444-555555555501';
DELETE FROM storage_addons WHERE user_id='11111111-2222-3333-4444-555555555501';