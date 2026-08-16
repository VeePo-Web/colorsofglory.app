import { useEffect, useState } from "react";
import TrappedDialog from "@/components/canvas/TrappedDialog";

/**
 * ImportCoachSheet — the once-per-device picture coach (Lane D · Moment 2).
 *
 * iOS offers NO share-into-web path, permanently (T2): the only universal
 * route from the Voice Memos app is Share → Save to Files → our picker. So
 * the world-class move is not a magic API — it is this: two illustrated
 * steps, shown ONCE, at the exact moment of need, never blocking (one gold
 * tap goes straight to the picker), and reachable forever after through a
 * quiet "here's how" link. Android and desktop never see it — their pickers
 * need no ritual.
 *
 * The seen-marker lands when the sheet is SHOWN, not when it is completed —
 * a dismissal is an answer too, and the coach must never nag twice.
 */

export const IMPORT_COACH_KEY = "cog:import-coach-seen";

/** iPhone / iPad detection — iPadOS 13+ masquerades as MacIntel + touch. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

export function hasSeenImportCoach(): boolean {
  try {
    return localStorage.getItem(IMPORT_COACH_KEY) === "1";
  } catch {
    return true; // storage unavailable → never risk a nag loop
  }
}

export function markImportCoachSeen(): void {
  try {
    localStorage.setItem(IMPORT_COACH_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

/** Coach only where the ritual exists (iOS) and only once per device. */
export function shouldCoachImport(): boolean {
  return isIOSDevice() && !hasSeenImportCoach();
}

interface ImportCoachSheetProps {
  /** The one gold action — closes the coach and opens the native picker. */
  onChooseFile: () => void;
  onClose: () => void;
}

const PathChip = ({ children }: { children: string }) => (
  <span
    style={{
      display: "inline-block",
      backgroundColor: "var(--cog-cream-dark)",
      borderRadius: 8,
      padding: "2px 8px",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--cog-charcoal)",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const ImportCoachSheet = ({ onChooseFile, onClose }: ImportCoachSheetProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Shown = seen. A dismissal is an answer; the coach never nags twice.
    markImportCoachSeen();
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 899,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 280ms ease",
        }}
        aria-hidden="true"
      />
      <TrappedDialog
        onClose={onClose}
        aria-label="How to bring a voice memo from your phone"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 900,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "0 22px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "85dvh",
          overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 18px" }}
          aria-hidden="true"
        />
        <h2
          style={{
            margin: "0 0 18px",
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--cog-charcoal)",
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          Two taps in Voice Memos, and it&rsquo;s home
        </h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {[
            {
              n: "1",
              body: (
                <>
                  In <strong>Voice Memos</strong>: <PathChip>Share</PathChip>{" "}
                  <span aria-hidden="true">→</span> <PathChip>Save to Files</PathChip>{" "}
                  <span aria-hidden="true">→</span> <PathChip>Save</PathChip>
                </>
              ),
            },
            {
              n: "2",
              body: (
                <>
                  Back here: <PathChip>Browse</PathChip> <span aria-hidden="true">→</span>{" "}
                  <PathChip>Recents</PathChip> — your memo is at the top
                </>
              ),
            },
          ].map((step) => (
            <li key={step.n} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "var(--cog-gold)",
                  color: "#FFF",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {step.n}
              </span>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "var(--cog-charcoal)",
                }}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onChooseFile}
          style={{
            width: "100%",
            minHeight: 56,
            marginTop: 8,
            borderRadius: 16,
            border: "none",
            backgroundColor: "var(--cog-gold)",
            color: "#FFF",
            fontFamily: "var(--font-body)",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Choose the file
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            minHeight: 44,
            marginTop: 6,
            background: "transparent",
            border: "none",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </TrappedDialog>
    </>
  );
};

export default ImportCoachSheet;
