import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { type ReactNode } from "react";

// End-to-end four-role verification of the REAL hook: mock only the two inputs
// (A4's useAuth session, A3's myRole RPC) and assert the resolved capabilities.
// This is the definitive "each role sees exactly the right capabilities" check.

const mockAuth = vi.fn();
const mockMyRole = vi.fn();

vi.mock("@/lib/auth/AuthContext", async (io) => {
  const actual = await io<typeof import("@/lib/auth/AuthContext")>();
  return { ...actual, useAuth: () => mockAuth() };
});
vi.mock("@/integrations/cog/members", async (io) => {
  const actual = await io<typeof import("@/integrations/cog/members")>();
  return { ...actual, myRole: (id: string) => mockMyRole(id) };
});

import { useCapabilities } from "@/lib/permissions";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const AUTHED = { status: "authed", user: { id: "u1" }, session: {} };

describe("useCapabilities — four roles + edge states (E1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue(AUTHED);
  });

  it("OWNER — full control", async () => {
    mockMyRole.mockResolvedValue("owner");
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    await waitFor(() => expect(result.current.role).toBe("owner"));
    expect(result.current.isOwner).toBe(true);
    expect(result.current.isViewer).toBe(false);
    for (const c of ["edit", "record", "suggest", "review", "invite", "manageRoles", "removeMember", "editMeta", "deleteSong"] as const) {
      expect(result.current.can(c)).toBe(true);
    }
  });

  it("CONTRIBUTOR — adds content, cannot manage people", async () => {
    mockMyRole.mockResolvedValue("collaborator");
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    await waitFor(() => expect(result.current.role).toBe("contributor"));
    expect(result.current.can("edit")).toBe(true);
    expect(result.current.can("record")).toBe(true);
    expect(result.current.can("suggest")).toBe(true);
    expect(result.current.can("invite")).toBe(false);
    expect(result.current.can("manageRoles")).toBe(false);
    expect(result.current.can("deleteSong")).toBe(false);
    expect(result.current.isViewer).toBe(false);
  });

  it("REVIEWER (permission flag) — comment/approve, never edit", async () => {
    mockMyRole.mockResolvedValue("collaborator");
    const { result } = renderHook(() => useCapabilities("s1", { reviewer: true }), { wrapper });
    await waitFor(() => expect(result.current.role).toBe("reviewer"));
    expect(result.current.can("suggest")).toBe(true);
    expect(result.current.can("review")).toBe(true);
    expect(result.current.can("edit")).toBe(false);
    expect(result.current.can("record")).toBe(false);
  });

  it("VIEWER — read-only everywhere", async () => {
    mockMyRole.mockResolvedValue("viewer");
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    await waitFor(() => expect(result.current.isViewer).toBe(true));
    expect(result.current.can("view")).toBe(true);
    for (const c of ["edit", "record", "suggest", "review", "invite", "manageRoles"] as const) {
      expect(result.current.can(c)).toBe(false);
    }
  });

  it("NON-MEMBER (authed, myRole=null) — read-only", async () => {
    mockMyRole.mockResolvedValue(null);
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    await waitFor(() => expect(result.current.isViewer).toBe(true));
    expect(result.current.can("edit")).toBe(false);
    expect(result.current.dbRole).toBeNull();
  });

  it("LOADING — optimistic contributor, never flash-locked, admin deferred", () => {
    mockMyRole.mockReturnValue(new Promise<never>(() => {})); // never resolves
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isViewer).toBe(false);
    expect(result.current.can("edit")).toBe(true); // creative surface stays open
    expect(result.current.can("manageRoles")).toBe(false); // admin waits for confirm
  });

  it("UNAUTHENTICATED (demo/onboarding) — local owner, no doomed RPC", () => {
    mockAuth.mockReturnValue({ status: "anon", user: null, session: null });
    const { result } = renderHook(() => useCapabilities("s1"), { wrapper });
    expect(result.current.isLocalMode).toBe(true);
    expect(result.current.isViewer).toBe(false);
    expect(result.current.can("edit")).toBe(true);
    expect(mockMyRole).not.toHaveBeenCalled();
  });
});
