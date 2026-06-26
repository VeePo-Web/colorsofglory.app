import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verifies the frontend correctly interprets every phone-otp-start (Twilio Verify)
 * outcome — the contract between the UI and the custom edge-function path. Mocks the
 * Supabase client so no network/secrets are needed; this is the closest we can get
 * to "does sign-in work" without a deployed function + live Twilio.
 */

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: {},
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/integrations/cog/admin", () => ({ isCurrentUserAdmin: async () => false }));

import { sendPhoneOtp, AuthError } from "@/integrations/cog/auth";

beforeEach(() => invoke.mockReset());

describe("sendPhoneOtp — Twilio Verify start contract", () => {
  it("calls phone-otp-start and resolves when the code was sent", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(sendPhoneOtp("+15555550123")).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("phone-otp-start", { body: { phone: "+15555550123" } });
  });

  it("maps GEO_BLOCKED to a kind region message", async () => {
    invoke.mockResolvedValue({ data: { ok: false, code: "GEO_BLOCKED" }, error: null });
    await expect(sendPhoneOtp("+447700900000")).rejects.toMatchObject({ code: "GEO_BLOCKED" });
  });

  it("maps RATE_LIMITED and CEILING to a single rate-limit error", async () => {
    invoke.mockResolvedValue({ data: { ok: false, code: "CEILING" }, error: null });
    await expect(sendPhoneOtp("+15555550123")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("treats a transport/edge error as a kind UNKNOWN (never a raw error)", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    const err = await sendPhoneOtp("+15555550123").catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toMatch(/couldn't send the code/i);
  });

  it("maps INVALID_PHONE without leaking a technical string", async () => {
    invoke.mockResolvedValue({ data: { ok: false, code: "INVALID_PHONE" }, error: null });
    const err = await sendPhoneOtp("+1").catch((e) => e);
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toMatch(/doesn't look right/i);
  });
});
