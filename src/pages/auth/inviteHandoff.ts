/**
 * Invite continuity bridge (auth-screen lane).
 *
 * Two invite mechanisms exist today:
 *   - `cog:invite-token`   — the flat key A5's `routeAfterAuth` reads to send a
 *                            just-authenticated user to `/join/:token`.
 *   - `cog:invite-context` — the rich blob the invite flow (B3) writes, with the
 *                            token nested inside.
 *
 * If a user opens an invite deep-link but authenticates through the MAIN
 * `/auth/*` path (e.g. they were signed out and bounced to login), only the
 * context blob is present — so `routeAfterAuth` reads a null token and strands
 * the invite. This bridge copies the token OUT of the context into the flat key
 * so the deep-link survives auth, without touching A5's reader.
 *
 * Canonical key = `cog:invite-token`. Call once right before `routeAfterAuth`.
 * FOLLOW-UP (A5/B3): fold this reconciliation into `routeAfterAuth` itself so the
 * flat key becomes the single source of truth and this bridge can retire.
 */

const TOKEN_KEY = "cog:invite-token";
const CONTEXT_KEY = "cog:invite-context";

export function reconcileInviteToken(): void {
  try {
    if (sessionStorage.getItem(TOKEN_KEY)) return; // flat key already set — done
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return;
    const token = (JSON.parse(raw) as { token?: unknown } | null)?.token;
    if (typeof token === "string" && token.length > 0) {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // storage/parse unavailable — no-op; the user still lands via routeAfterAuth.
  }
}
