import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useEffect, useState, useCallback } from "react";
import { isCurrentUserAdmin } from "@/integrations/cog/admin";

// ─── Auth SDK ─────────────────────────────────────────────────────────────
// Thin typed wrappers around supabase.auth. UI lives in src/pages and
// src/components (Claude). Lovable only owns this SDK file.

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "WEAK_PASSWORD"
  | "RATE_LIMITED"
  | "PHONE_PROVIDER_DISABLED"
  | "GEO_BLOCKED"
  | "INVALID_OTP"
  | "OAUTH_FAILED"
  | "NETWORK"
  | "UNKNOWN";

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function classify(err: unknown): AuthError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const code = (err as { code?: string } | null)?.code ?? "";
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return new AuthError("INVALID_CREDENTIALS", "That email and password didn't match.");
  }
  if (msg.includes("email not confirmed")) {
    return new AuthError("EMAIL_NOT_CONFIRMED", "Please confirm your email first — check your inbox.");
  }
  if (msg.includes("weak") || msg.includes("pwned") || msg.includes("compromised")) {
    return new AuthError("WEAK_PASSWORD", "That password is too weak or has appeared in a breach. Pick a stronger one.");
  }
  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit") || msg.includes("too many")) {
    return new AuthError("RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }
  // Narrow, specific match only — a bare "provider" substring used to dead-end
  // unrelated errors on the "not available" message. Require the real signal.
  if (
    code === "phone_provider_disabled" ||
    msg.includes("unsupported phone provider") ||
    msg.includes("phone provider") ||
    msg.includes("provider is not enabled") ||
    msg.includes("sms provider")
  ) {
    return new AuthError("PHONE_PROVIDER_DISABLED", "Text sign-in is just being switched on. Use email below to continue now.");
  }
  // Phone OTP signups turned off in the dashboard surfaces as this distinct error.
  if (code === "otp_disabled" || msg.includes("signups not allowed for otp") || msg.includes("signup is disabled")) {
    return new AuthError("PHONE_PROVIDER_DISABLED", "Text sign-in is just being switched on. Use email below to continue now.");
  }
  if (code === "otp_expired" || msg.includes("expired")) {
    return new AuthError("INVALID_OTP", "That code expired. Tap resend to get a new one.");
  }
  if (msg.includes("invalid") || msg.includes("otp") || msg.includes("token")) {
    return new AuthError("INVALID_OTP", "That code didn't work. Try requesting a new one.");
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return new AuthError("NETWORK", "Network problem. Check your connection and try again.");
  }
  return new AuthError("UNKNOWN", raw || "Something went wrong. Please try again.");
}

// ─── Email + password ────────────────────────────────────────────────────

export async function signInWithPassword(input: { email: string; password: string }): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error || !data.session) throw classify(error ?? new Error("no_session"));
  return data.session;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ user: User | null; needsConfirmation: boolean }> {
  // Legacy entry point — preserved so existing callers don't break, but the
  // canonical signup path is now: startEmailOtp({purpose:'signup'}) →
  // verifyEmailOtp({purpose:'signup'}) → signInWithPassword. All branded code
  // emails go through Resend from `<sender>@colorsofglory.app`, never through
  // the default Supabase/Lovable templates.
  await startEmailOtp({ email: input.email, purpose: "signup" });
  return { user: null, needsConfirmation: true };
}

// ─── Email OTP (signup / login / reset) ─────────────────────────────────

export type EmailOtpPurpose = "signup" | "login" | "reset";

export async function startEmailOtp(input: { email: string; purpose: EmailOtpPurpose }): Promise<void> {
  const { data, error } = await supabase.functions.invoke("email-otp-start", {
    body: { email: input.email.trim().toLowerCase(), purpose: input.purpose },
  });
  if (error) throw classify(error);
  if (data && (data as { error?: string }).error) {
    const e = (data as { error: string }).error;
    if (e === "rate_limited") throw new AuthError("RATE_LIMITED", "Too many code requests. Wait a minute and try again.");
    if (e === "email_in_use") throw new AuthError("UNKNOWN", "That email already has an account. Try signing in instead.");
    if (e === "send_failed") throw new AuthError("NETWORK", "We couldn't send the code. Please try again.");
    throw new AuthError("UNKNOWN", "Couldn't start verification. Please try again.");
  }
}

export async function verifyEmailOtp(input: {
  email: string;
  code: string;
  purpose: EmailOtpPurpose;
  password?: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("email-otp-verify", {
    body: {
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      purpose: input.purpose,
      password: input.password,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    },
  });
  if (error) throw classify(error);
  const err = (data as { error?: string; remaining?: number } | null)?.error;
  if (err === "invalid_code") throw new AuthError("INVALID_OTP", "That code didn't match. Try again.");
  if (err === "invalid_or_expired") throw new AuthError("INVALID_OTP", "That code expired. Tap resend.");
  if (err === "too_many_attempts") throw new AuthError("RATE_LIMITED", "Too many wrong codes. Request a new one.");
  if (err === "weak_password") throw new AuthError("WEAK_PASSWORD", "Pick a password with at least 8 characters.");
  if (err === "email_in_use") throw new AuthError("UNKNOWN", "That email already has an account.");
  if (err === "not_found") throw new AuthError("UNKNOWN", "No account found for that email.");
  if (err) throw new AuthError("UNKNOWN", "Couldn't verify the code. Please try again.");
}

/** Convenience: full signup → verify → session in one call. */
export async function completeEmailSignup(input: {
  email: string;
  password: string;
  code: string;
  firstName?: string;
  lastName?: string;
}): Promise<Session> {
  await verifyEmailOtp({
    email: input.email,
    code: input.code,
    purpose: "signup",
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  return signInWithPassword({ email: input.email, password: input.password });
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Branded path only: send a 6-digit code via Resend through email-otp-start.
  // Supabase's default recovery email is intentionally bypassed.
  await startEmailOtp({ email, purpose: "reset" });
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw classify(error);
}

// ─── Google OAuth ────────────────────────────────────────────────────────

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw classify(error);
}

// ─── Phone OTP ───────────────────────────────────────────────────────────

export async function sendPhoneOtp(e164: string, captchaToken?: string): Promise<void> {
  // Custom Twilio Verify path. The native Supabase phone provider is OFF on
  // Lovable Cloud (returns phone_provider_disabled), so we run our own:
  //   phone-otp-start  → otp-guard rails + Twilio Verify send
  //   phone-otp-verify → Twilio Verify check + Admin API user upsert
  void captchaToken; // reserved for future CAPTCHA forwarding
  const { data, error } = await supabase.functions.invoke("phone-otp-start", { body: { phone: e164 } });
  if (error) throw new AuthError("UNKNOWN", "We couldn't send the code. Please try again.");
  const resp = (data ?? {}) as { ok?: boolean; code?: string };
  if (resp.ok) return;
  switch (resp.code) {
    case "GEO_BLOCKED":
      throw new AuthError("GEO_BLOCKED", "SMS sign-in isn't available in your region yet. Try email instead.");
    case "RATE_LIMITED":
    case "CEILING":
      throw new AuthError("RATE_LIMITED", "Too many code requests. Please wait a minute and try again.");
    case "INVALID_PHONE":
      throw new AuthError("UNKNOWN", "That phone number doesn't look right. Check it and try again.");
    default:
      throw new AuthError("UNKNOWN", "We couldn't send the code. Please try again.");
  }
}

export async function verifyPhoneOtp(e164: string, code: string): Promise<Session> {
  const { data, error } = await supabase.functions.invoke("phone-otp-verify", {
    body: { phone: e164, code },
  });
  if (error) throw new AuthError("UNKNOWN", "We couldn't verify that code. Please try again.");
  const resp = (data ?? {}) as { ok?: boolean; code?: string; password?: string; email?: string };
  if (!resp.ok || !resp.password || !resp.email) {
    switch (resp.code) {
      case "INVALID_OTP":
        throw new AuthError("INVALID_OTP", "That code isn't right. Double-check and try again.");
      case "EXPIRED":
        throw new AuthError("INVALID_OTP", "That code expired. Send a new one.");
      case "MAX_ATTEMPTS":
        throw new AuthError("RATE_LIMITED", "Too many attempts. Send a new code and try again.");
      default:
        throw new AuthError("UNKNOWN", "We couldn't verify that code. Please try again.");
    }
  }
  // Exchange the one-shot password for a real session via the email grant
  // (the native phone provider is disabled on Cloud).
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: resp.email,
    password: resp.password,
  });
  if (signInErr || !signIn.session) throw classify(signInErr ?? new Error("no_session"));
  return signIn.session;
}

// ─── Session / sign out ──────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Trusted user lookup — re-validates with the Auth server. */
export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// ─── React hook: useCurrentAccount ───────────────────────────────────────

export type AccountProfile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  phone_e164: string | null;
  referral_code: string | null;
};

export type CurrentAccount = {
  loading: boolean;
  user: User | null;
  profile: AccountProfile | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useCurrentAccount(): CurrentAccount {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [profileRes, adminRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, avatar_url, avatar_color, phone_e164, referral_code")
        .eq("user_id", u.id)
        .maybeSingle(),
      isCurrentUserAdmin(),
    ]);
    setProfile((profileRes.data as AccountProfile | null) ?? null);
    setIsAdmin(Boolean(adminRes));
  }, []);

  useEffect(() => {
    let mounted = true;

    // Register listener FIRST so we don't miss events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      // Defer Supabase calls out of the callback to avoid deadlocks.
      setTimeout(() => {
        if (mounted) void load(nextUser);
      }, 0);
    });

    // THEN hydrate initial user.
    void getSessionUser().then(async (u) => {
      if (!mounted) return;
      setUser(u);
      await load(u);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const u = await getSessionUser();
    setUser(u);
    await load(u);
  }, [load]);

  return {
    loading,
    user,
    profile,
    isAdmin,
    signOut: async () => {
      await signOut();
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    },
    refresh,
  };
}
