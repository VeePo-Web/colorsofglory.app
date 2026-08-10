import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, Mic, X } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { DEDICATION_MAX } from "@/lib/songs/dedication";

/**
 * NewSongRail — starting a song, in the Golden Path's rail grammar
 * (docs/flow/GOLDEN-PATH.md; GuidedShapeRail is the reference implementation):
 * one card at a time · every card skippable · it ends in arrival.
 *
 *   Card 1 · Name the song      (skip ⇒ "New song"; rename any time)
 *   Card 2 · Who is it for?     (the "for…" dedication — a quiet line the
 *                                song remembers; only if you want)
 *   → the room (the existing brainstorm arrival — the spark surface itself).
 *
 * Nothing exists until the final act, so ✕ loses nothing — the one rail whose
 * dismissal is genuinely free.
 */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const STEPS = ["name", "for"] as const;

export interface NewSongRailProps {
  open: boolean;
  /** Album context — the new song joins this body of work. */
  albumName?: string | null;
  creating: boolean;
  onCreate: (payload: { title: string; dedication: string | null }) => void;
  onClose: () => void;
}

const NewSongRail = ({ open, albumName, creating, onCreate, onClose }: NewSongRailProps) => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [dedication, setDedication] = useState("");
  const dialogRef = useModalFocusTrap(onClose);
  const nameRef = useRef<HTMLInputElement>(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (open) {
      setStep(0);
      setTitle("");
      setDedication("");
    }
  }, [open]);
  useEffect(() => {
    if (open && step === 0) nameRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const finalTitle = title.trim() || "New song";
  const create = (withDedication: boolean) =>
    onCreate({ title: finalTitle, dedication: withDedication ? dedication : null });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1.5px solid var(--cog-border, rgba(28,26,23,0.10))",
    backgroundColor: "#FFFFFF",
    color: "var(--cog-charcoal)",
    fontSize: 16, // ≥16px: iOS must never zoom the sheet
    outline: "none",
    boxSizing: "border-box",
  };
  const goldBtn: React.CSSProperties = {
    minHeight: 50,
    width: "100%",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    backgroundColor: "var(--cog-gold)",
    color: "#FFFFFF",
    fontFamily: "var(--font-body)",
    fontSize: 14.5,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: creating ? 0.7 : 1,
  };
  const quietBtn: React.CSSProperties = {
    minHeight: 44,
    width: "100%",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "var(--cog-warm-gray)",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <>
      <div
        onClick={creating ? undefined : onClose}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 899, backgroundColor: "rgba(26,26,26,0.5)" }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Start a new song"
        tabIndex={-1}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 900,
          outline: "none",
          backgroundColor: "var(--cog-cream-light, #FAF7F2)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "18px 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxWidth: 480,
          margin: "0 auto",
          animation: reduce ? "none" : `cog-newsong-rise 320ms ${EASE}`,
        }}
      >
        <style>{`
          @keyframes cog-newsong-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes cog-newsong-step { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        `}</style>

        {/* Progress dots + dismiss — the rail's shared head. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span
                key={s}
                aria-hidden="true"
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: i === step ? "var(--cog-gold)" : "rgba(28,26,23,0.18)",
                  transition: `width 240ms ${EASE}, background-color 240ms ${EASE}`,
                }}
              />
            ))}
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--cog-muted)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
              {step + 1} of {STEPS.length}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                aria-label="Back"
                style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "transparent", color: "var(--cog-warm-gray)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ArrowLeft size={17} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              aria-label="Close — nothing is created yet"
              style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.05)", color: "var(--cog-warm-gray)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* One card at a time — keyed rise, the rail grammar. */}
        <div key={STEPS[step]} style={{ animation: reduce ? "none" : `cog-newsong-step 240ms ${EASE}` }}>
          {STEPS[step] === "name" && (
            <div>
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--cog-charcoal)" }}>
                Name the song
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
                {albumName ? `It'll join ${albumName}. ` : ""}You can rename it any time.
              </p>
              <input
                ref={nameRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setStep(1);
                  }
                }}
                placeholder="e.g. Grace in the waiting"
                aria-label="Song name"
                autoCapitalize="words"
                style={fieldStyle}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                <button type="button" onClick={() => setStep(1)} style={goldBtn}>
                  {title.trim() ? "Name it" : "Next"}
                </button>
                <button type="button" onClick={() => setStep(1)} style={quietBtn}>
                  Skip — call it “New song” for now
                </button>
              </div>
            </div>
          )}

          {STEPS[step] === "for" && (
            <div>
              <p style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--cog-charcoal)" }}>
                <Heart size={16} strokeWidth={2} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
                Who is it for?
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
                A quiet line the song remembers — “for the youth night,” “for Mom.” Only if you want.
              </p>
              <input
                value={dedication}
                onChange={(e) => setDedication(e.target.value.slice(0, DEDICATION_MAX))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating) {
                    e.preventDefault();
                    create(true);
                  }
                }}
                placeholder="for…"
                aria-label="Who this song is for"
                style={fieldStyle}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                <button type="button" onClick={() => create(true)} disabled={creating} style={goldBtn}>
                  <Mic size={15} strokeWidth={2.2} />
                  {creating ? "Starting…" : `Start “${finalTitle}”`}
                </button>
                <button type="button" onClick={() => create(false)} disabled={creating} style={quietBtn}>
                  Skip — just start the song
                </button>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--cog-muted)", fontFamily: "var(--font-body)", textAlign: "center" }}>
                You can change both any time.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NewSongRail;
