import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

// ── Supabase auth mock: one controllable onAuthStateChange + getSession ──────
type AuthCb = (event: string, session: unknown) => void;
const authState: { cb: AuthCb | null; subCount: number; initial: unknown } = {
  cb: null,
  subCount: 0,
  initial: null,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCb) => {
        authState.cb = cb;
        authState.subCount += 1;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: () => Promise.resolve({ data: { session: authState.initial } }),
    },
  },
}));

import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { invalidationMap } from "@/lib/cache/invalidation";
import { qk } from "@/lib/cache/queryKeys";
import { beginOptimistic, rollbackOptimistic } from "@/lib/cache/optimistic";
import { isPreviewUnlocked, setPreviewUnlocked } from "@/lib/preview/previewUnlock";
import { ONBOARDING_STEPS } from "@/lib/onboarding/onboardingStep";

const session = (id: string) => ({ user: { id }, access_token: "t" });

function AuthProbe() {
  const { status, user } = useAuth();
  return <div data-testid="probe">{status}:{user?.id ?? "none"}</div>;
}

beforeEach(() => {
  authState.cb = null;
  authState.subCount = 0;
  authState.initial = null;
  sessionStorage.clear();
});

describe("AuthProvider", () => {
  it("opens exactly one subscription and transitions anon → authed → signout with no flicker", async () => {
    authState.initial = null; // start anon
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(authState.subCount).toBe(1);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("anon:none"));

    await act(async () => authState.cb!("SIGNED_IN", session("u1")));
    expect(screen.getByTestId("probe").textContent).toBe("authed:u1");

    await act(async () => authState.cb!("SIGNED_OUT", null));
    expect(screen.getByTestId("probe").textContent).toBe("anon:none");

    expect(authState.subCount).toBe(1);
  });
});

describe("invalidation policy", () => {
  it("commitTake invalidates song detail, canvas, activity, memos", () => {
    const keys = invalidationMap.commitTake("s1").map((k) => JSON.stringify(k));
    expect(keys).toContain(JSON.stringify(qk.songDetail("s1")));
    expect(keys).toContain(JSON.stringify(qk.canvas("s1")));
    expect(keys).toContain(JSON.stringify(qk.activity("s1")));
    expect(keys).toContain(JSON.stringify(qk.memos("s1")));
  });

  it("createSong touches the catalog and billing quota", () => {
    const keys = invalidationMap.createSong().map((k) => JSON.stringify(k));
    expect(keys).toEqual([JSON.stringify(qk.songs()), JSON.stringify(qk.billing())]);
  });

  it("moveNode is targeted — only the canvas view, never the whole board", () => {
    expect(invalidationMap.moveNode("s1")).toEqual([qk.canvas("s1")]);
  });
});

describe("optimistic helper", () => {
  it("applies then rolls back to the exact snapshot on error", async () => {
    const client = new QueryClient();
    const key = qk.songDetail("s1");
    client.setQueryData(key, { title: "Original" });

    const ctx = await beginOptimistic<{ title: string }>(client, key, (prev) => ({
      ...(prev ?? { title: "" }),
      title: "Optimistic",
    }));
    expect(client.getQueryData(key)).toEqual({ title: "Optimistic" });

    rollbackOptimistic(client, ctx);
    expect(client.getQueryData(key)).toEqual({ title: "Original" });
  });
});

describe("preview unlock", () => {
  it("round-trips through the typed helper", () => {
    expect(isPreviewUnlocked()).toBe(false);
    setPreviewUnlocked();
    expect(isPreviewUnlocked()).toBe(true);
    expect(sessionStorage.getItem("site_unlocked")).toBe("true");
  });
});

describe("onboarding steps", () => {
  it("enumerates all 11 values including the two that used to be swallowed", () => {
    expect(ONBOARDING_STEPS).toHaveLength(11);
    expect(ONBOARDING_STEPS).toContain("referral_program_seen");
    expect(ONBOARDING_STEPS).toContain("founder_code_seen");
  });
});
