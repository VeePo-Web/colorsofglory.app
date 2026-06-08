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
  if (code === "over_sms_send_rate_limit" || msg.includes("rate")) {
    return new AuthError("RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }
  if (code === "phone_provider_disabled" || msg.includes("unsupported phone provider") || msg.includes("provider")) {
    return new AuthError("PHONE_PROVIDER_DISABLED", "SMS sign-in isn't available yet.");
  }
  if (msg.includes("otp") || msg.includes("token")) {
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
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
      },
    },
  });
  if (error) throw classify(error);
  return { user: data.user, needsConfirmation: !data.session };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw classify(error);
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
    },
  });
  if (error) throw classify(error);
}

// ─── Phone OTP ───────────────────────────────────────────────────────────

export async function sendPhoneOtp(e164: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) throw classify(error);
}

export async function verifyPhoneOtp(e164: string, code: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: code,
    type: "sms",
  });
  if (error || !data.session) throw classify(error ?? new Error("no_session"));
  return data.session;
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
