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
 *   3. Onboarding step   → resume the right onboarding screen / song
 *   4. Fallback          → songs exist ? /home : /onboarding/intent
 *
 * lib/ may use the raw supabase client directly (pages must use the auth SDK).
 */

import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REPLACE = { replace: true } as const;

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
      .select("onboarding_step, first_song_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const step = profile?.onboarding_step ?? "not_started";
    const firstSongId = profile?.first_song_id ?? null;

    switch (step) {
      case "not_started":
      case "intent_selected":
        // No song yet — keep them in the create-first-song lane.
        navigate(
          step === "not_started" ? "/onboarding/intent" : "/onboarding/start-song",
          REPLACE,
        );
        return;
      case "completed":
      case "dismissed":
        navigate("/home", REPLACE);
        return;
      default:
        // Mid-onboarding (song created, capturing ideas, lyrics, etc.) —
        // drop them back inside the song so momentum continues.
        navigate(firstSongId ? `/songs/${firstSongId}` : "/home", REPLACE);
        return;
    }
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
