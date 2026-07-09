import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import ScripturePicker from "@/components/capture/ScripturePicker";

/**
 * CardEditSheet — write the actual idea into a canvas card.
 *
 * The canvas could create cards but never let you fill them: "Add idea" made
 * an empty "New idea" you could never type into. This is the focused editor
 * that opens on create (so you write the idea right away) and on tapping Edit.
 * Bottom-sheet idiom matches the room's other sheets; iOS-safe (16px inputs to
 * avoid zoom, keyboard never covers the field, Escape/backdrop close).
 */
export interface CardEditDraft {
  title: string;
  body: string;
  section: string;
  /** Kind-specific metadata line — e.g. "Key of G · 74 BPM" on a chord card. */
  meta?: string;
}

interface CardEditSheetProps {
  initial: CardEditDraft;
  /** Plain-language kind for the header, e.g. "Lyric", "Voice memo". */
  kind: string;
  accent: string;
  onSave: (draft: CardEditDraft) => void;
  onClose: () => void;
}

const CardEditSheet = ({ initial, kind, accent, onSave, onClose }: CardEditSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [section, setSection] = useState(initial.section);
  const [meta, setMeta] = useState(initial.meta ?? "");
  const titleRef = useRef<HTMLInputElement>(null);
  const didSave = useRef(false);

  const isChord = kind === "Chord";
  const isScripture = kind === "Scripture";
  // The structured verse picker (book/chapter/verse, real passage fetch) —
  // the faith-first heart, finally one tap from the canvas.
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    // Focus the title so a freshly created card is ready to type into.
    const f = window.setTimeout(() => titleRef.current?.focus(), 260);
    return () => { cancelAnimationFrame(t); window.clearTimeout(f); };
  }, []);

  const buildDraft = (): CardEditDraft => ({
    title: title.trim() || "Untitled idea",
    body: body.trim(),
    section: section.trim() || "Raw idea",
    meta: meta.trim() || undefined,
  });

  const save = () => {
    if (didSave.current) return;
    didSave.current = true;
    onSave(buildDraft());
    onClose();
  };

  // "Nothing is ever lost": Escape / backdrop tap SAVES the draft instead of
  // discarding a just-composed lyric to a stray thumb.
  const dismiss = () => {
    if (didSave.current) { onClose(); return; }
    didSave.current = true;
    const changed =
      title !== initial.title || body !== initial.body ||
      section !== initial.section || meta !== (initial.meta ?? "");
    if (changed) onSave(buildDraft());
    onClose();
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fieldStyle: React.CSSProperties = {
    width: "100%", borderRadius: 12, padding: "12px 14px",
    backgroundColor: "var(--cog-cream)", border: "1.5px solid var(--cog-border, rgba(28,26,23,0.10))",
    color: "var(--cog-charcoal)", fontFamily: "var(--font-body)", fontSize: 16, outline: "none",
    caretColor: "var(--cog-gold)", boxSizing: "border-box",
  };

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0, transition: "opacity 260ms ease",
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit idea"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "0 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "88dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 340ms cubic-bezier(0.22, 1, 0.36, 1)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 14px" }} aria-hidden="true" />
        <button
          type="button"
          onClick={dismiss}
          style={{
            position: "absolute", top: 8, right: 16, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cog-warm-gray)",
          }}
          aria-label="Close editor (your words are kept)"
        >
          <X size={18} />
        </button>

        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: accent, marginBottom: 10 }}>
          {kind}
        </p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--cog-warm-gray)", marginBottom: 6, fontFamily: "var(--font-body)" }}>
          Title
        </label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          placeholder="Name this idea"
          aria-label="Idea title"
          autoCapitalize="sentences"
          style={{ ...fieldStyle, marginBottom: 14 }}
        />

        {isScripture && !showPicker && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              minHeight: 48, padding: "0 14px", marginBottom: 14,
              borderRadius: 12, cursor: "pointer",
              backgroundColor: "rgba(110,155,99,0.10)",
              border: "1.5px solid rgba(110,155,99,0.35)",
              color: "#48703F", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
            }}
            aria-label="Find the verse — search by book, chapter, and verse"
          >
            <BookOpen size={16} strokeWidth={1.8} />
            Find the verse
          </button>
        )}
        {isScripture && showPicker && (
          <div style={{ marginBottom: 14 }}>
            <ScripturePicker
              onPicked={(label, text) => {
                // The reference becomes the card's name; the passage lands
                // above the writer's own "why". Ref also rides in meta for
                // future tap-through.
                setTitle(label);
                setMeta(label);
                setBody((prev) => (prev.trim() ? `${text}\n\n${prev}` : text));
                setShowPicker(false);
              }}
              onFallback={() => setShowPicker(false)}
            />
          </div>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--cog-warm-gray)", marginBottom: 6, fontFamily: "var(--font-body)" }}>
          {isChord ? "Progression" : isScripture ? "Verse & why it anchors the song" : "The idea"}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isChord
              ? "C - G - Am - F"
              : isScripture
              ? "Psalm 46:10 — Be still before the second verse turns upward."
              : "Write the lyric, the thought, the direction…"
          }
          aria-label={isChord ? "Chord progression" : isScripture ? "Scripture and meaning" : "Idea content"}
          rows={4}
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
          style={{ ...fieldStyle, marginBottom: 14, resize: "none", fontFamily: "var(--font-display)", lineHeight: 1.5 }}
        />

        {isChord && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--cog-warm-gray)", marginBottom: 6, fontFamily: "var(--font-body)" }}>
              Key &amp; BPM
            </label>
            <input
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Key of G · 74 BPM"
              aria-label="Key and BPM"
              autoCapitalize="words"
              style={{ ...fieldStyle, marginBottom: 14 }}
            />
          </>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--cog-warm-gray)", marginBottom: 6, fontFamily: "var(--font-body)" }}>
          Section
        </label>
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Verse 1, Chorus, Bridge…"
          aria-label="Section"
          autoCapitalize="words"
          style={{ ...fieldStyle, marginBottom: 18 }}
        />

        <button
          type="button"
          onClick={save}
          style={{
            width: "100%", minHeight: 56, borderRadius: 16, border: "none", cursor: "pointer",
            backgroundColor: "var(--cog-gold)", color: "#FFFFFF",
            fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 700,
            boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
          }}
        >
          Save idea
        </button>
      </div>
    </>
  );
};

export default CardEditSheet;
