import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The seam error contract (src/integrations/cog/errors.ts). Every backend call
 * in the app funnels through `toCogError` (direct PostgREST/RPC/storage) or
 * `call` (edge functions); both must yield a `CogError` whose `.code` the UI can
 * switch on — never a raw error string. These assertions lock the two codes the
 * product gates MOMENTS on (QUOTA_EXCEEDED_STORAGE → storage screen) and the
 * write-permission wall (FORBIDDEN), end-to-end through both entry points.
 *
 * The Supabase client is mocked so no env/network is needed — the same pattern
 * the phone-otp suites use.
 */
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: {},
    rpc: async () => ({ data: null, error: null }),
  },
}));

import { CogError, toCogError, codeFromServer, call } from "@/integrations/cog/errors";

beforeEach(() => invoke.mockReset());

describe("toCogError — direct PostgREST / RPC / storage normalization", () => {
  it("maps SQLSTATE 42501 (RLS insufficient_privilege) to FORBIDDEN", () => {
    const e = toCogError({ code: "42501", message: "permission denied for table songs" });
    expect(e).toBeInstanceOf(CogError);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("FORBIDDEN");
  });

  it("maps a row-level-security message with no SQLSTATE to FORBIDDEN", () => {
    expect(
      toCogError({ message: "new row violates row-level security policy for table" }).code,
    ).toBe("FORBIDDEN");
  });

  it("maps JWT / auth failures to UNAUTHENTICATED", () => {
    expect(toCogError({ code: "PGRST301", message: "JWT expired" }).code).toBe("UNAUTHENTICATED");
    expect(toCogError({ message: "invalid JWT" }).code).toBe("UNAUTHENTICATED");
  });

  it("preserves a semantic code an RPC RAISEd as its message (QUOTA_EXCEEDED_STORAGE)", () => {
    // A SECURITY DEFINER RPC that RAISEs 'QUOTA_EXCEEDED_STORAGE' surfaces the
    // token in `.message`; the direct-RPC path must recover the code.
    expect(toCogError({ message: "QUOTA_EXCEEDED_STORAGE" }).code).toBe("QUOTA_EXCEEDED_STORAGE");
    expect(toCogError({ code: "P0001", message: "INVITE_EXPIRED" }).code).toBe("INVITE_EXPIRED");
  });

  it("is idempotent — an existing CogError passes through unchanged", () => {
    const c = new CogError("FORBIDDEN", "no access");
    expect(toCogError(c)).toBe(c);
  });

  it("falls back to INTERNAL for an unrecognized error", () => {
    expect(toCogError({ message: "kaboom" }).code).toBe("INTERNAL");
    expect(toCogError(null).code).toBe("INTERNAL");
  });
});

describe("codeFromServer — edge slug / envelope-code mapping", () => {
  it("maps the storage-quota slug to QUOTA_EXCEEDED_STORAGE", () => {
    expect(codeFromServer("storage_limit_reached").code).toBe("QUOTA_EXCEEDED_STORAGE");
  });

  it("maps the song-quota slug to QUOTA_EXCEEDED_SONGS and keeps the slug on .message", () => {
    const e = codeFromServer("song_limit_reached");
    expect(e.code).toBe("QUOTA_EXCEEDED_SONGS");
    // message-matching callers (e.g. ReviewSheet) still see the raw slug.
    expect(e.message).toBe("song_limit_reached");
  });

  it("maps the forbidden slug to FORBIDDEN", () => {
    expect(codeFromServer("forbidden").code).toBe("FORBIDDEN");
  });

  it("passes a canonical UPPER code through verbatim", () => {
    expect(codeFromServer("QUOTA_EXCEEDED_STORAGE").code).toBe("QUOTA_EXCEEDED_STORAGE");
  });

  it("preserves an unknown slug verbatim as the code (signal never lost)", () => {
    const e = codeFromServer("take_not_found");
    expect(e.code).toBe("take_not_found");
    expect(e.message).toBe("take_not_found");
  });
});

describe("call — edge-function wrapper preserves codes end-to-end", () => {
  it("recovers QUOTA_EXCEEDED_STORAGE from a non-2xx legacy { error } body", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ error: "storage_limit_reached" }) },
      },
    });
    await expect(call("voice-memo-upload-url", {})).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED_STORAGE",
    });
  });

  it("recovers FORBIDDEN from a non-2xx { ok:false, code } envelope", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "non-2xx",
        context: { json: async () => ({ ok: false, code: "FORBIDDEN", message: "no access" }) },
      },
    });
    const err = await call("commit-take", {}).catch((e) => e as CogError);
    expect(err).toBeInstanceOf(CogError);
    expect((err as CogError).code).toBe("FORBIDDEN");
  });

  it("maps QUOTA_EXCEEDED_SONGS (commit-take, new song) from a non-2xx body", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "non-2xx",
        context: { json: async () => ({ error: "song_limit_reached" }) },
      },
    });
    await expect(call("commit-take", {})).rejects.toMatchObject({ code: "QUOTA_EXCEEDED_SONGS" });
  });

  it("returns the bare payload on success", async () => {
    invoke.mockResolvedValue({ data: { song_id: "s1", card_ids: ["c1"] }, error: null });
    await expect(call("commit-take", {})).resolves.toEqual({ song_id: "s1", card_ids: ["c1"] });
  });

  it("unwraps env.data on a { ok:true, data } envelope", async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: { url: "https://x/a.webm" } }, error: null });
    await expect(call("voice-memo-signed-url", {})).resolves.toEqual({ url: "https://x/a.webm" });
  });
});
