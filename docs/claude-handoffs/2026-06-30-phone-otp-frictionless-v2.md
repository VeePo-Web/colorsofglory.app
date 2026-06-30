# Phone Sign-In — Frictionless v2 (Church Center–grade)

**Lane:** Frontend (Claude). Lovable owns the edge functions + DB; this doc only changes UI/UX.
**Status:** Backend ready and verified — see acceptance criteria below.

---

## What changed in the backend (so you know what to surface)

`sendPhoneOtp` (in `src/integrations/cog/auth.ts`) now throws an `AuthError` with these additions:

```ts
class AuthError {
  code: "COOLDOWN" | "RATE_LIMITED" | "CEILING" | "GEO_BLOCKED" | ...
  retryAfterSeconds?: number   // present on COOLDOWN / RATE_LIMITED / CEILING
  message: string
}
```

Mapping the UI should honour:

| `code` | Meaning | UI behavior |
|---|---|---|
| `COOLDOWN` | Same phone re-sent within 30s | **Disable "Send" with a live countdown** (`Try again in 0:24`). No toast — inline, calm. |
| `RATE_LIMITED` | Hit per-phone 15m or 24h cap, or per-IP 1h cap | Show `retryAfterSeconds` as a live countdown ("Try again in 12 min") + nudge to email fallback below. |
| `CEILING` | Global daily SMS ceiling tripped | Distinct copy: **"SMS is briefly unavailable. Use email and we'll text you next time."** Auto-switch focus to the email button. |
| `GEO_BLOCKED` | Number isn't in `otp_geo_allowlist` (today: `+1` only) | "SMS sign-in isn't available in your region yet. Try email instead." Auto-switch to email. |

---

## What to change in the UI

### 1. `PhoneLoginPage.tsx` — Send button

Replace the static "Send code" button + toast pattern with a self-healing button that owns its own countdown:

```tsx
const [cooldown, setCooldown] = useState(0); // seconds remaining

// on submit:
try {
  await sendPhoneOtp(e164);
  navigate("/auth/phone/verify");
} catch (err) {
  if (err instanceof AuthError && err.retryAfterSeconds) {
    setCooldown(err.retryAfterSeconds);
  }
  setInlineMessage(err.message); // never a destructive-red toast
}

// countdown tick:
useEffect(() => {
  if (cooldown <= 0) return;
  const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
  return () => clearInterval(t);
}, [cooldown]);

// button label:
const label = cooldown > 0 ? `Try again in ${formatMmSs(cooldown)}` : "Send code";
<GoldButton disabled={cooldown > 0} loading={sending}>{label}</GoldButton>
```

`formatMmSs(s)`: `< 60` → `0:24`; `>= 60` → `12:03`. No 0-pad on minutes.

### 2. `CodeVerifyPage.tsx` — Resend

Same pattern on the **Resend code** affordance — when `sendPhoneOtp` throws `COOLDOWN`/`RATE_LIMITED`, keep the existing 30s resend timer in sync with `err.retryAfterSeconds` (take the max).

### 3. `CEILING` and `GEO_BLOCKED` — the gentle off-ramp

When either fires, the "Use email instead" link below the form becomes the primary affordance: solid gold, full width, with the inline copy from the table above. The phone field stays visible (no dead end) but de-emphasised (charcoal → muted).

### 4. The "Call me instead" fallback

Spec calls for a voice-OTP fallback. Backend isn't wired yet — for v2, link "Call me instead" to the **email path** with copy: "We'll email you a code now and call you in the future." Track the click as `phone_signin.fallback.email` so we can prove demand before wiring Twilio Voice.

---

## Acceptance criteria (all already pass on the backend)

Verified via `supabase--curl_edge_functions /phone-otp-start`:

- ✅ Fresh phone → `{ok:true}`; SMS arrives with WebOTP zero-tap line
  (`@colorsofglory.app #123456`) on the last line. Android Chrome auto-fills.
- ✅ Same phone within 30s → `{ok:false, code:"COOLDOWN", retry_after_seconds:N}`.
- ✅ 5 sends in 15m (6th attempt) → `RATE_LIMITED` with real seconds-until-window-opens.
- ✅ Country regex fixed: `+14038308930` records as country `+1`, not `140`.
- ✅ Verify path: O(1) profile lookup, no `auth.admin.listUsers` walk; password
  is deterministic (pepper-derived), no longer rotates on each verify.

The UI just needs to read `err.retryAfterSeconds`, drive the countdown, and pick the right copy from the table.

---

## Anti-patterns to avoid

- ❌ A destructive-red toast that says "Too many tries" when it's actually a 30s debounce.
- ❌ A spinner that hides the countdown — show the countdown *on* the button.
- ❌ Generic copy. Distinguish `COOLDOWN` (you, 30s) vs `RATE_LIMITED` (you, minutes) vs `CEILING` (everyone, switch channels).
- ❌ Removing the email fallback — every blocked phone path must have an open email path beside it.
