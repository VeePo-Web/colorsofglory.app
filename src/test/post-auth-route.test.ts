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

function setStep(step: string | null) {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  maybeSingle.mockResolvedValue({ data: step === null ? null : { onboarding_step: step } });
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

  it("keeps a pre-song user in the create-first-song lane", async () => {
    for (const step of ["intent_selected", "referral_program_seen", "founder_code_seen"]) {
      vi.clearAllMocks();
      setStep(step);
      const navigate = vi.fn();
      await routeAfterAuth(navigate);
      expect(navigate).toHaveBeenCalledWith("/onboarding/start-song", REPLACE);
      expect(updateOnboardingStep).not.toHaveBeenCalled();
    }
  });

  it("lands a returning user (song already created) on /home and completes onboarding once", async () => {
    for (const step of [
      "first_song_created",
      "first_idea_captured",
      "first_voice_memo_added",
      "first_lyrics_added",
      "first_collaborator_invited",
    ]) {
      vi.clearAllMocks();
      setStep(step);
      const navigate = vi.fn();
      await routeAfterAuth(navigate);
      expect(navigate).toHaveBeenCalledWith("/home", REPLACE);
      expect(updateOnboardingStep).toHaveBeenCalledWith("completed");
    }
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
    expect(navigate).toHaveBeenCalledWith("/invite/tok-123", REPLACE);
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
