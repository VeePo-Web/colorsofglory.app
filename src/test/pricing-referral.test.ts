import { describe, it, expect, vi, beforeEach } from "vitest";

// The referral screen's earnings, recent-activity feed, and payout method all
// flow through fetchReferralStats. This locks the mapper's contract with the
// me-referrals edge function (incl. fields added for the activity feed and
// payout-method UI) and the money formatter the screen renders with.

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { fetchReferralStats, centsToDisplay } from "@/lib/pricing/pricingApi";

beforeEach(() => vi.clearAllMocks());

describe("centsToDisplay", () => {
  it("renders zero as $0", () => {
    expect(centsToDisplay(0)).toBe("$0");
  });

  it("omits decimals for whole-dollar amounts", () => {
    const out = centsToDisplay(500);
    expect(out).toContain("5");
    expect(out).not.toContain(".");
  });

  it("shows two decimals for non-whole amounts", () => {
    expect(centsToDisplay(1050)).toMatch(/10[.,]50/);
  });
});

describe("fetchReferralStats", () => {
  it("maps the full me-referrals payload, including recent activity and payout method", async () => {
    invoke.mockResolvedValue({
      data: {
        code: "GRACE",
        link: "https://colorsofglory.app/r/GRACE",
        attributed_count: 3,
        paying_count: 2,
        per_referral_cents: 500,
        monthly_recurring_cents: 1000,
        earnings: { pending_cents: 250, payable_cents: 500, paid_cents: 750, lifetime_cents: 1500 },
        next_payout_estimate_cents: 500,
        recent_referrals: [
          { referred_at: "2026-06-01T00:00:00Z", is_paying: true, has_paid_before: true, total_earned_cents: 500 },
          { referred_at: "2026-06-10T00:00:00Z", is_paying: false, has_paid_before: false, total_earned_cents: 0 },
        ],
        payout_method: { kind: "paypal", email: "founder@example.com", country: "CA" },
      },
      error: null,
    });

    const s = await fetchReferralStats();

    expect(invoke).toHaveBeenCalledWith("me-referrals");
    expect(s.code).toBe("GRACE");
    expect(s.link).toBe("https://colorsofglory.app/r/GRACE");
    expect(s.attributedCount).toBe(3);
    expect(s.payingCount).toBe(2);
    expect(s.perReferralCents).toBe(500);
    expect(s.monthlyRecurringCents).toBe(1000);
    expect(s.earnings).toEqual({ pendingCents: 250, payableCents: 500, paidCents: 750, lifetimeCents: 1500 });
    expect(s.nextPayoutEstimateCents).toBe(500);
    expect(s.recentReferrals).toHaveLength(2);
    expect(s.recentReferrals[0]).toEqual({
      referredAt: "2026-06-01T00:00:00Z",
      isPaying: true,
      hasPaidBefore: true,
      totalEarnedCents: 500,
    });
    expect(s.recentReferrals[1].isPaying).toBe(false);
    expect(s.payoutMethod).toEqual({ kind: "paypal", email: "founder@example.com" });
  });

  it("applies safe defaults for an empty payload (no crash, no fake data)", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });

    const s = await fetchReferralStats();

    // 500 is the live user_referral_cash_cents default; the screen derives its
    // copy from this, so it must never silently become something else.
    expect(s.perReferralCents).toBe(500);
    expect(s.recentReferrals).toEqual([]);
    expect(s.payoutMethod).toEqual({ kind: null, email: null });
    expect(s.monthlyRecurringCents).toBe(0);
    expect(s.code).toBeNull();
    expect(s.link).toBeNull();
  });

  it("ignores a non-array recent_referrals instead of crashing", async () => {
    invoke.mockResolvedValue({ data: { recent_referrals: "oops" }, error: null });
    const s = await fetchReferralStats();
    expect(s.recentReferrals).toEqual([]);
  });

  it("throws when the edge function returns an error", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("me-referrals failed") });
    await expect(fetchReferralStats()).rejects.toThrow("me-referrals failed");
  });
});
