import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  canShowReferralPrompt,
  markReferralPromptShown,
  optOutOfReferralPrompts,
  subscribeReferralPrompt,
  triggerReferralPrompt,
} from "@/components/referral/referralPromptState";

// F3 calm rules (docs/REFERRAL-CONTRACT.md §3): once per moment per song,
// one prompt per 7 days globally, "don't show again" is permanent.

describe("referralPromptState — frequency caps + dismissal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a fresh moment to show", () => {
    expect(canShowReferralPrompt("invite_sent", "song-1")).toBe(true);
  });

  it("fires each moment at most once per song, ever", () => {
    markReferralPromptShown("invite_sent", "song-1");
    expect(canShowReferralPrompt("invite_sent", "song-1")).toBe(false);
    // A different song or moment is a different key — still gated by the
    // global cooldown though (checked separately below).
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
    expect(canShowReferralPrompt("invite_sent", "song-2")).toBe(true);
    expect(canShowReferralPrompt("collaborator_joined", "song-1")).toBe(true);
  });

  it("enforces the global 7-day cooldown across songs and moments", () => {
    markReferralPromptShown("invite_sent", "song-1");
    expect(canShowReferralPrompt("collaborator_joined", "song-2")).toBe(false);
    vi.setSystemTime(new Date("2026-07-16T12:00:01Z")); // 8 days later
    expect(canShowReferralPrompt("collaborator_joined", "song-2")).toBe(true);
  });

  it("honors the permanent opt-out everywhere", () => {
    optOutOfReferralPrompts();
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    expect(canShowReferralPrompt("invite_sent", "song-9")).toBe(false);
    expect(canShowReferralPrompt("milestone", "song-9")).toBe(false);
  });

  it("triggerReferralPrompt notifies a subscribed host only when caps allow", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeReferralPrompt(listener);

    triggerReferralPrompt("invite_sent", "song-1");
    expect(listener).toHaveBeenCalledWith({ moment: "invite_sent", songId: "song-1" });

    markReferralPromptShown("invite_sent", "song-1");
    listener.mockClear();
    triggerReferralPrompt("invite_sent", "song-1"); // capped → silent
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("is a safe no-op with no host subscribed", () => {
    expect(() => triggerReferralPrompt("invite_sent", "song-1")).not.toThrow();
  });
});
