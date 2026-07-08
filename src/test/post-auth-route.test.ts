import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// routeAfterAuth reads the just-authenticated user + their onboarding_step and
// decides where they land. We mock the supabase client (auth + profiles query)
// and the onboarding-step writer so we can assert routing per step.

const getUser = vi.fn();
const maybeSingle = vi.fn();
const songsLimit = vi.fn(() => Promise.resolve({ data: [] }));
const updateOnboardingStep = vi.fn(() => Promise.resolve());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingle() }),
        limit: () => songsLimit(),
      }),
    }),
  },
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (s: string) => updateOnboardingStep(s),
}));

import { routeAfterAuth } from "@/lib/auth/postAuthRoute";

const REPLACE = { replace: true };

function setStep(step: string | null, firstSongId: string | null = null) {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  maybeSingle.mockResolvedValue({
    data: step === null ? null : { onboarding_step: step, first_song_id: firstSongId },
  });
}

describe("routeAfterAuth — post-auth resume routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("sends a brand-new user to the intent screen", async () => {
    setStep("not_started");
    const navigate = vi.fn();
    await routeAfterAuth(navigate);
    expect(navigate).toHaveBeenCalledWith("/onboarding/intent", REPLACE);
    expect(updateOnboardingStep).not.toHaveBeenCalled();
  });

  it("resumes each pre-song step on its own screen (typed STEP_ROUTE, no swallow)", async () => {
    const expected: Record<string, string> = {
      intent_selected: "/onboarding/start-song",
      referral_program_seen: "/onboarding/earn",
      founder_code_seen: "/onboarding/founder-code",
    };
    for (const [step, route] of Object.entries(expected)) {
      vi.clearAllMocks();
      setStep(step);
      const navigate = vi.fn();
      await routeAfterAuth(navigate);
      expect(navigate).toHaveBeenCalledWith(route, REPLACE);
      expect(updateOnboardingStep).not.toHaveBeenCalled();
    }
  });

  it("drops a mid-onboarding user back inside their song so momentum continues", async () => {
    for (const step of [
      "first_song_created",
      "first_idea_captured",
      "first_voice_memo_added",
      "first_lyrics_added",
      "first_collaborator_invited",
    ]) {
      vi.clearAllMocks();
      setStep(step, "s1");
      const navigate = vi.fn();
      await routeAfterAuth(navigate);
      expect(navigate).toHaveBeenCalledWith("/songs/s1", REPLACE);
    }
  });

  it("guards a null first_song_id — never builds /songs/null", async () => {
    setStep("first_song_created", null);
    const navigate = vi.fn();
    await routeAfterAuth(navigate);
    expect(navigate).toHaveBeenCalledWith("/onboarding/start-song", REPLACE);

    vi.clearAllMocks();
    setStep("first_idea_captured", null);
    const navigate2 = vi.fn();
    await routeAfterAuth(navigate2);
    expect(navigate2).toHaveBeenCalledWith("/home", REPLACE);
  });

  it("does not re-mark onboarding for an already-completed or dismissed user", async () => {
    for (const step of ["completed", "dismissed"]) {
      vi.clearAllMocks();
      setStep(step);
      const navigate = vi.fn();
      await routeAfterAuth(navigate);
      expect(navigate).toHaveBeenCalledWith("/home", REPLACE);
      expect(updateOnboardingStep).not.toHaveBeenCalled();
    }
  });

  it("resumes a pending invite before any onboarding routing", async () => {
    setStep("first_voice_memo_added");
    sessionStorage.setItem("cog:invite-token", "tok-123");
    const navigate = vi.fn();
    await routeAfterAuth(navigate);
    expect(navigate).toHaveBeenCalledWith("/join/tok-123", REPLACE);
    expect(updateOnboardingStep).not.toHaveBeenCalled();
  });

  it("resumes a pending checkout above everything else", async () => {
    setStep("completed");
    sessionStorage.setItem("cog:pending-checkout", "1");
    const navigate = vi.fn();
    await routeAfterAuth(navigate);
    expect(navigate).toHaveBeenCalledWith("/upgrade", REPLACE);
  });
});
