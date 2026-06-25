import { useEffect } from "react";

/**
 * WebOTP auto-read — the lowest-friction path: no typing at all.
 *
 * On supported browsers (Android Chrome) this listens for the incoming SMS and,
 * with the user's one-tap consent, pulls the code straight out of the message.
 * Requires the SMS body to end with a domain-bound line (`@domain #code`) — see
 * docs/auth/PHONE-OTP-FRICTIONLESS.md §3. Until the Twilio template includes that
 * line this silently no-ops; iOS keyboard autofill (`autocomplete="one-time-code"`)
 * still works with no backend change. Fully progressive — never blocks manual entry.
 *
 * Owned at the verify-screen level (one listener) so two mounted OTP inputs can
 * never fire competing `navigator.credentials.get({ otp })` requests.
 *
 * @param enabled  only arm while the verify screen is mounted and idle
 * @param onCode   called with the retrieved code (caller fills boxes + submits)
 */
export function useWebOtpAutofill(enabled: boolean, onCode: (code: string) => void): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;
    if (!navigator.credentials) return;

    const ac = new AbortController();
    let cancelled = false;

    navigator.credentials
      .get({
        // `otp` is a valid CredentialRequestOptions member where WebOTP is
        // supported; the DOM lib doesn't type it yet, so widen the call site.
        otp: { transport: ["sms"] },
        signal: ac.signal,
      } as CredentialRequestOptions & { otp: { transport: string[] } })
      .then((cred) => {
        if (cancelled || !cred) return;
        const code = (cred as { code?: string }).code?.replace(/\D/g, "");
        if (code && code.length >= 4) onCode(code);
      })
      .catch(() => {
        // Aborted on unmount, declined by the user, or unsupported — all fine.
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [enabled, onCode]);
}
