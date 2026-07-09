import { useEffect, useRef, useState } from "react";
import ReferralPrompt from "./ReferralPrompt";
import ShareReferralSheet from "./ShareReferralSheet";
import {
  markReferralPromptShown,
  optOutOfReferralPrompts,
  subscribeReferralPrompt,
  triggerReferralPrompt,
  type ReferralPromptRequest,
} from "./referralPromptState";

/**
 * ReferralPromptHost — mount ONCE per host surface (e.g. the People screen).
 *
 * Owns everything after a moment fires: listening on the trigger bus, marking
 * the cap state when a prompt actually shows, the dismiss / permanent opt-out
 * actions, and opening the shared ShareReferralSheet. Host screens only do two
 * things — render <ReferralPromptHost songId={...}/> and call
 * triggerReferralPrompt(moment, songId) at their collaboration moments
 * (see docs/REFERRAL-CONTRACT.md).
 *
 * Passing collaboratorCount also lets the host detect the "collaborator
 * joined" moment with zero coupling: it remembers the last count per song
 * (per device) and fires when the room grows.
 */
interface ReferralPromptHostProps {
  songId: string;
  /** Current member count, when the host surface knows it (People screen). */
  collaboratorCount?: number;
}

const COUNT_KEY_PREFIX = "cog:referral-prompt:members:";

/** Small delay so the nudge lands after the moment's own success UI settles. */
const SHOW_DELAY_MS = 900;

const ReferralPromptHost = ({ songId, collaboratorCount }: ReferralPromptHostProps) => {
  const [request, setRequest] = useState<ReferralPromptRequest | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeReferralPrompt((req) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        // Re-checking is unnecessary (trigger already gated) but marking here
        // means the cooldown starts only when the prompt is truly on screen.
        markReferralPromptShown(req.moment, req.songId);
        setRequest(req);
      }, SHOW_DELAY_MS);
    });
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  // "Collaborator joined" detection: the room grew since this device last saw it.
  useEffect(() => {
    if (collaboratorCount === undefined || collaboratorCount === 0) return;
    const key = `${COUNT_KEY_PREFIX}${songId}`;
    let last = 0;
    try { last = Number(localStorage.getItem(key) ?? "0") || 0; } catch { /* private mode */ }
    if (last > 0 && collaboratorCount > last) {
      triggerReferralPrompt("collaborator_joined", songId);
    }
    try { localStorage.setItem(key, String(collaboratorCount)); } catch { /* private mode */ }
  }, [collaboratorCount, songId]);

  if (!request && !shareOpen) return null;

  return (
    <>
      {request && (
        <ReferralPrompt
          moment={request.moment}
          onShare={() => { setRequest(null); setShareOpen(true); }}
          onDismiss={() => setRequest(null)}
          onOptOut={() => { optOutOfReferralPrompts(); setRequest(null); }}
        />
      )}
      <ShareReferralSheet open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
};

export default ReferralPromptHost;
