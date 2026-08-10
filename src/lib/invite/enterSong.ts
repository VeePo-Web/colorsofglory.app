import type { NavigateFunction } from "react-router-dom";
import { clearInviteContext, loadInviteContext } from "./inviteContext";

/**
 * The one way every invite path ends: straight into the song's room.
 *
 * Lands on the CANVAS — the core songwriting room — not the lyric sheet. The
 * canvas is where the role-aware experience lives: an invited viewer is locked
 * to read-only there (isViewer) with the "ask the owner to contribute"
 * affordance. `invite=1` triggers the one-time welcome toast; `role` drives
 * the lock.
 *
 * Invite context lost (storage cleared/unavailable)? The catalog is the one
 * always-correct landing — the just-joined song is right there. Never a
 * hardcoded song id that opens someone else's song.
 */
export function enterInvitedSong(navigate: NavigateFunction): void {
  const ctx = loadInviteContext();
  const songId = ctx?.songId ?? null;
  const role = ctx?.assignedRole ?? "contributor";
  clearInviteContext();
  if (!songId) {
    navigate("/", { replace: true });
    return;
  }
  navigate(`/songs/${songId}/canvas?invite=1&role=${role}`, { replace: true });
}
