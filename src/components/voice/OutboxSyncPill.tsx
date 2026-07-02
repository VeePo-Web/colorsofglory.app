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
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    // Seed from current state, then track every change.
    setPending(pendingCount());
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") setPending(event.pending);
    });
    return unsubscribe;
  }, []);

  // Connection awareness: offline, "syncing" is a lie — the take is safe and
  // *waiting*. Say so pastorally so the songwriter never thinks it's stuck.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (pending <= 0) return null;

  const noun = pending === 1 ? "idea" : "ideas";
  const label = online
    ? `Syncing ${pending} ${noun}…`
    : `${pending} ${noun} saved · will sync when you're back online`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-outbox-sync-pill=""
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
          flexShrink: 0,
          // Breathe only while actually syncing (online). Offline the dot rests
          // steady — the take is safe and waiting, not working. Never a spinner.
          animation: online ? "outbox-sync-breath 1.6s ease-in-out infinite" : "none",
          opacity: online ? undefined : 0.7,
        }}
      />
      {label}
      <style>{`
        @keyframes outbox-sync-breath {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-outbox-sync-pill] span[aria-hidden="true"] { animation: none !important; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default OutboxSyncPill;
