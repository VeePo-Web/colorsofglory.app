import { useEffect, useState } from "react";
import { pendingCount, subscribeOutbox } from "@/lib/voice/captureOutbox";

/**
 * A calm, reusable reassurance that no captured idea is stranded. While the
 * Capture Outbox holds takes waiting to sync (offline, dropped upload, retrying),
 * this pill quietly reports how many — gold, never red, because the takes are
 * already safe in local storage. It vanishes the moment everything has synced.
 *
 * Reusable anywhere a capture surface lives; mount once near a header. Driven
 * entirely by the outbox's `change` events, so it always reflects truth.
 */
const OutboxSyncPill = () => {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    // Seed from current state, then track every change.
    setPending(pendingCount());
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") setPending(event.pending);
    });
    return unsubscribe;
  }, []);

  if (pending <= 0) return null;

  const label = pending === 1 ? "Syncing 1 idea…" : `Syncing ${pending} ideas…`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 9999,
        backgroundColor: "rgba(184,149,58,0.12)",
        border: "1px solid rgba(184,149,58,0.28)",
        color: "var(--cog-gold)",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: "var(--cog-gold)",
          // Calm confirmation that work is in progress — a gentle breath, never a
          // spinner or alarm. Honors reduced-motion via the keyframe guard below.
          animation: "outbox-sync-breath 1.6s ease-in-out infinite",
        }}
      />
      {label}
      <style>{`
        @keyframes outbox-sync-breath {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] span[aria-hidden="true"] { animation: none !important; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default OutboxSyncPill;
