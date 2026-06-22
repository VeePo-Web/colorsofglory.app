/**
 * Centralized post-authentication router.
 *
 * The ONE place that decides where a just-authenticated user lands. Every auth
 * entry point (phone OTP, email/password, invite verify) funnels through here so
 * routing-by-intent is consistent and an interrupted onboarding resumes correctly.
 *
 * Priority order:
 *   1. Pending checkout  → /upgrade   (resume Stripe Embedded Checkout)
 *   2. Pending invite    → /invite/:token
 *   3. Onboarding step   → resume the right onboarding screen, or land home
 *   4. Fallback          → songs exist ? /home : /onboarding/intent
 *
 * Resume rule — this function runs ONLY on an explicit fresh sign-in (phone OTP
 * verify, email login/signup), never on silent session restore. So if a user has
 * already created their first song, reaching this router means they left and came
 * back in a new session — a returning user in steady state. We land them on /home
 * (which surfaces "Continue last song" one tap away) instead of re-dropping them
 * back inside that one song on every login, and we graduate them out of the
 * guided first run exactly once by marking onboarding `completed`.
 *
 * lib/ may use the raw supabase client directly (pages must use the auth SDK).
 */

import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";

const REPLACE = { replace: true } as const;

/**
 * Onboarding steps that precede first-song creation. While the user is in this
 * set they have no song yet, so a fresh sign-in keeps them in the guided
 * create-first-song lane. Every later step means a song exists.
 */
const PRE_SONG_STEPS = new Set([
  "intent_selected",
  "referral_program_seen",
  "founder_code_seen",
]);

export async function routeAfterAuth(navigate: NavigateFunction): Promise<void> {
  // 1. Pending checkout intent wins — bring the user straight back to /upgrade.
  if (sessionStorage.getItem("cog:pending-checkout")) {
    navigate("/upgrade", REPLACE);
    return;
  }

  // 2. Pending invite — finish joining the song they were invited to.
  const inviteToken = sessionStorage.getItem("cog:invite-token");
  if (inviteToken) {
    navigate(`/invite/${inviteToken}`, REPLACE);
    return;
  }

  // 3. Resume by onboarding step.
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
      .select("onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle();

    const step = profile?.onboarding_step ?? "not_started";

    // No song yet — keep them in the guided create-first-song lane.
    if (step === "not_started") {
      navigate("/onboarding/intent", REPLACE);
      return;
    }
    if (PRE_SONG_STEPS.has(step)) {
      navigate("/onboarding/start-song", REPLACE);
      return;
    }

    // A song exists. A fresh sign-in here = a returning user in steady state.
    // Graduate them out of the guided first run exactly once, then land home.
    if (step !== "completed" && step !== "dismissed") {
      updateOnboardingStep("completed").catch(() => {});
    }
    navigate("/home", REPLACE);
    return;
  } catch {
    // Fallback: route on whether any song is reachable.
    try {
      const { data } = await supabase.from("songs").select("id").limit(1);
      navigate(data && data.length > 0 ? "/home" : "/onboarding/intent", REPLACE);
    } catch {
      navigate("/onboarding/intent", REPLACE);
    }
  }
}
