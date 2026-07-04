import { useEffect, useState } from "react";
import { Mic, Music, StickyNote, X } from "lucide-react";

/**
 * AddPartSheet — the clean, instant way to build the song's structure.
 *
 * Songwriters think in PARTS (Verse, Chorus, Bridge…), not "generic ideas".
 * Tap a part and a card for it is created and opened, ready to write. A quiet
 * second row covers the raw captures (lyric line, chord, note). Snapchat-clean:
 * big tap targets, one gesture, no forms.
 */
export type PartKind =
  | { section: string; type: "lyric" }
  | { section: "Raw idea"; type: "lyric" | "chord" | "note" };

interface AddPartSheetProps {
  onPick: (choice: { section: string; type: "lyric" | "chord" | "note" }) => void;
  onClose: () => void;
}

const PARTS = ["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Hook", "Outro", "Tag"];

const QUICK: Array<{ label: string; type: "lyric" | "chord" | "note"; icon: typeof Mic }> = [
  { label: "Lyric line", type: "lyric", icon: StickyNote },
  { label: "Chord idea", type: "chord", icon: Music },
];

const AddPartSheet = ({ onPick, onClose }: AddPartSheetProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.5)",
          opacity: visible ? 1 : 0, transition: "opacity 240ms ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a part to the song"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "0 18px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
          maxHeight: "85dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 12px" }} aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 14, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#666",
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", margin: "0 6px 2px" }}>
          Add a part
        </h2>
        <p style={{ fontSize: 13, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", margin: "0 6px 14px" }}>
          Build the song, one section at a time.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PARTS.map((part) => (
            <button
              key={part}
              type="button"
              onClick={() => onPick({ section: part, type: "lyric" })}
              style={{
                minHeight: 56, borderRadius: 16, cursor: "pointer",
                backgroundColor: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.08)",
                color: "var(--cog-charcoal)", fontFamily: "var(--font-display)",
                fontSize: 16, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color 150ms ease, background-color 150ms ease",
              }}
              onPointerDown={(e) => { e.currentTarget.style.borderColor = "var(--cog-gold)"; e.currentTarget.style.backgroundColor = "rgba(184,149,58,0.06)"; }}
              onPointerUp={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              onPointerLeave={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
            >
              {part}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--cog-muted)", fontFamily: "var(--font-body)", margin: "18px 6px 8px" }}>
          Or a quick idea
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {QUICK.map(({ label, type, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick({ section: "Raw idea", type })}
              style={{
                flex: 1, minHeight: 52, borderRadius: 14, cursor: "pointer",
                backgroundColor: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.08)",
                color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Icon size={16} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default AddPartSheet;
