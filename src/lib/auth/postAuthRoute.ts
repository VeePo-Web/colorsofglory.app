/**
 * Centralized post-authentication router.
 *
 * The ONE place that decides where a just-authenticated user lands. Every auth
 * entry point (phone OTP, email/password, invite verify) funnels through here so
 * routing-by-intent is consistent and an interrupted onboarding resumes correctly.
 *
 * Priority order:
 *   1. Pending checkout   → /upgrade   (resume Stripe Embedded Checkout)
 *   2. Pending invite     → /join/:token
 *   3. Deep-link return-to → the guarded page an anon user was bounced from
 *   4. Onboarding step    → the right onboarding screen / song (typed table)
 *   5. Fallback           → songs exist ? /home : /onboarding/intent
 *
 * lib/ may use the raw supabase client directly (pages must use the auth SDK).
 */

import type { NavigateFunction } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const REPLACE = { replace: true } as const;

type OnboardingStep = Database["public"]["Enums"]["onboarding_step"];

/**
 * Every onboarding_step → the screen a returning user resumes on. Typed as an
 * exhaustive Record so TypeScript fails the build if a new enum value is added
 * without a landing — this is what closes the old "swallow" bug, where
 * referral_program_seen / founder_code_seen fell into a default branch that
 * routed to /songs/:firstSongId when no song existed yet.
 */
const STEP_ROUTE: Record<OnboardingStep, (firstSongId: string | null) => string> = {
  not_started: () => "/onboarding/intent",
  intent_selected: () => "/onboarding/start-song",
  // These two run before a song exists — route to their own screens, never a song.
  referral_program_seen: () => "/onboarding/earn",
  founder_code_seen: () => "/onboarding/founder-code",
  // In-song milestones: drop them back inside the song so momentum continues;
  // guard the (shouldn't-happen) null song so we never build "/songs/null".
  first_song_created: (s) => (s ? `/songs/${s}` : "/onboarding/start-song"),
  first_idea_captured: (s) => (s ? `/songs/${s}` : "/home"),
  first_voice_memo_added: (s) => (s ? `/songs/${s}` : "/home"),
  first_lyrics_added: (s) => (s ? `/songs/${s}` : "/home"),
  first_collaborator_invited: (s) => (s ? `/songs/${s}` : "/home"),
  completed: () => "/home",
  dismissed: () => "/home",
};

/** Only resume internal, non-looping destinations from the return-to handoff. */
function isSafeReturnTo(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/auth") &&
    !path.startsWith("/onboarding")
  );
}

export async function routeAfterAuth(navigate: NavigateFunction): Promise<void> {
  // 1. Pending checkout intent wins — bring the user straight back to /upgrade.
  if (sessionStorage.getItem("cog:pending-checkout")) {
    navigate("/upgrade", REPLACE);
    return;
  }

  // 2. Pending invite — finish joining the song they were invited to, via the
  //    real frictionless join flow (not the legacy mock preview page).
  const inviteToken = sessionStorage.getItem("cog:invite-token");
  if (inviteToken) {
    navigate(`/join/${inviteToken}`, REPLACE);
    return;
  }

  // 3. Deep-link resume — a guarded page an anon user tried to open before login
  //    (RequireAuth stashed it; survives the phone-OTP page hop that drops
  //    router state). One-shot: consumed and cleared here.
  const returnTo = sessionStorage.getItem("cog:return-to");
  if (returnTo) {
    sessionStorage.removeItem("cog:return-to");
    if (isSafeReturnTo(returnTo)) {
      navigate(returnTo, REPLACE);
      return;
    }
  }

  // 4. Resume by onboarding step.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/login", REPLACE);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step, first_song_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const step = (profile?.onboarding_step ?? "not_started") as OnboardingStep;
    const firstSongId = profile?.first_song_id ?? null;

    const resolve = STEP_ROUTE[step] ?? STEP_ROUTE.not_started;
    navigate(resolve(firstSongId), REPLACE);
  } catch {
    // 5. Fallback: route on whether any song is reachable.
    try {
      const { data } = await supabase.from("songs").select("id").limit(1);
      navigate(data && data.length > 0 ? "/home" : "/onboarding/intent", REPLACE);
    } catch {
      navigate("/onboarding/intent", REPLACE);
    }
  }
}
