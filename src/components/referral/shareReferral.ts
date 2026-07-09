import { copyTextToClipboard } from "@/lib/invite/clipboard";

/**
 * F3 · The ONE canonical referral share message. The dashboard and every
 * in-song prompt share it through ShareReferralSheet — copy never diverges.
 * Warm, faith-toned, and it leads with what the FRIEND gets: first song free.
 */
export const REFERRAL_SHARE_MESSAGE =
  "I'm writing songs on Colors of Glory — lyrics, voice memos, and the people I write with all in one place for each song. Your first song is free:";

export const REFERRAL_FALLBACK_URL = "https://colorsofglory.app";

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

/**
 * One-tap share: native share sheet where available, clipboard fallback
 * everywhere else. A user dismissing the native sheet is NOT a failure —
 * callers only toast on "copied" / "failed".
 */
export async function shareReferralLink(url: string | null): Promise<ShareOutcome> {
  const shareUrl = url ?? REFERRAL_FALLBACK_URL;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Colors of Glory", text: REFERRAL_SHARE_MESSAGE, url: shareUrl });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "dismissed";
      // Real share failure → fall through to copy so the invite is never lost.
    }
  }
  const ok = await copyTextToClipboard(`${REFERRAL_SHARE_MESSAGE} ${shareUrl}`);
  return ok ? "copied" : "failed";
}
