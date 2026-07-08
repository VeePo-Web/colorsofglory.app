/**
 * Onboarding-step selector + routing-intent helpers (A4 · client state).
 *
 * profiles.onboarding_step is an 11-value enum. Post-auth routing used to
 * `switch` on a raw string and SILENTLY SWALLOW referral_program_seen and
 * founder_code_seen into the default branch — sending those users to a song that
 * may not exist. This module gives one typed table so no step is lost.
 *
 * NOTE: types are sourced from the generated Supabase types today. When A2's
 * `@/types` barrel lands, re-point OnboardingStep at Enums<'onboarding_step'>
 * from there (same underlying enum — this is the documented seam).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth/AuthContext";

export type OnboardingStep = Database["public"]["Enums"]["onboarding_step"];

/** Every enum value — the exhaustiveness guard for routing. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  "not_started",
  "intent_selected",
  "referral_program_seen",
  "founder_code_seen",
  "first_song_created",
  "first_idea_captured",
  "first_voice_memo_added",
  "first_lyrics_added",
  "first_collaborator_invited",
  "completed",
  "dismissed",
] as const;

export interface OnboardingState {
  loading: boolean;
  step: OnboardingStep | null;
  firstSongId: string | null;
}

/** Typed selector over the current user's onboarding_step (reads, never mutates). */
export function useOnboardingStep(): OnboardingState {
  const { status, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", user?.id],
    enabled: status === "authed" && Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_step, first_song_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    loading: status === "loading" || isLoading,
    step: (data?.onboarding_step as OnboardingStep | undefined) ?? null,
    firstSongId: (data?.first_song_id as string | null | undefined) ?? null,
  };
}

// ── Post-auth routing intents (typed, not raw reads) ────────────────────────

const PENDING_CHECKOUT_KEY = "cog:pending-checkout";
const INVITE_TOKEN_KEY = "cog:invite-token";

export const pendingCheckout = {
  get: (): boolean => safeGet(PENDING_CHECKOUT_KEY) !== null,
  set: (value: string): void => safeSet(PENDING_CHECKOUT_KEY, value),
  clear: (): void => safeRemove(PENDING_CHECKOUT_KEY),
};

export const pendingInviteToken = {
  get: (): string | null => safeGet(INVITE_TOKEN_KEY),
  set: (token: string): void => safeSet(INVITE_TOKEN_KEY, token),
  clear: (): void => safeRemove(INVITE_TOKEN_KEY),
};

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
