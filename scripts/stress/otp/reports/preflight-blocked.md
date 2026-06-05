# OTP Preflight Blocked

No SMS sends were made.

Fix or confirm these items before running send-capable scenarios:

- Supabase Auth -> Phone provider = Twilio, ENABLED (SMS_PROVIDER_TWILIO_ENABLED=)
- Twilio Messaging Service SID configured (TWILIO_MESSAGING_SERVICE_CONFIGURED=)
- A2P 10DLC campaign registered + APPROVED (A2P_10DLC_APPROVED=)
- SMS Pumping Protection: ON (SMS_PUMPING_PROTECTION_ON=)
- Geo Permissions: only US + CA enabled (GEO_PERMISSIONS_US_CA_ONLY=)
- Test OTPs +15555550100..+15555550119 -> 123456 configured (TEST_OTPS_CONFIGURED=)
- Operator typed "I CONFIRM SANDBOX" into CONFIRM env var (missing)

Run again:

```bash
npm run preflight
```
