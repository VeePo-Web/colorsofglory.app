import { useState } from "react";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";

/**
 * GuidedShapeRail — the hand that walks a fresh idea home.
 *
 * The moment a take is safe, this rail steps the songwriter through shaping
 * THIS idea — one calm question per card, in the order a song actually forms:
 *
 *   the words → which part of the song → the chords → where it lives.
 *
 * Every step is skippable in one tap and Back is always there; the last card
 * asks the only question that matters — add it to the song now, or keep it
 * loose in your ideas. Answers land as real blocks in the review below the
 * rail, so progress is visible as it happens. Dismissing the rail drops you
 * into the full editor — the guide is a path, never a cage.
 */

type StepId = "lyrics" | "section" | "chords" | "home";
const STEPS: StepId[] = ["lyrics", "section", "chords", "home"];

const SECTION_CHIPS: Array<{ kind: string; label: string }> = [
  { kind: "verse", label: "Verse" },
  { kind: "chorus", label: "Chorus" },
  { kind: "bridge", label: "Bridge" },
  { kind: "tag", label: "Tag" },
  { kind: "intro", label: "Intro" },
];

interface GuidedShapeRailProps {
  songTitle?: string;
  /** A real song is attached — the final card can commit to its canvas. */
  canCommit: boolean;
  committing?: boolean;
  /** The transcript already carries words — step 1 acknowledges instead of
   *  asking as if the take were silent. */
  hasWords?: boolean;
  /** Section kinds the take already holds (spoken "verse", added chips) —
   *  their chips show as done, and tapping one just advances (no duplicate). */
  heardSections?: string[];
  /** Song-less captures only: the writer's own songs, offered inline on the
   *  home card so filing is one tap — no second sheet over a sheet. */
  homeSongs?: Array<{ id: string; title: string }>;
  onCommitToSong?: (songId: string) => void;
  onAddLyrics: (text: string) => void;
  onSetSection: (kind: string, label: string) => void;
  onAddChords: (text: string) => void;
  onCommit: () => void;
  onKeepLoose: () => void;
  onDismiss: () => void;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const ghostBtn: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--cog-border, rgba(28,26,23,0.10))",
  backgroundColor: "transparent",
  color: "var(--cog-warm-gray)",
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

const goldBtn: React.CSSProperties = {
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  backgroundColor: "var(--cog-gold)",
  color: "#FFFFFF",
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(184,149,58,0.35)",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  padding: "12px 14px",
  backgroundColor: "#FFFFFF",
  border: "1.5px solid var(--cog-border, rgba(28,26,23,0.10))",
  color: "var(--cog-charcoal)",
  fontFamily: "var(--font-display)",
  fontSize: 16, // iOS: never trigger zoom-on-focus
  lineHeight: 1.5,
  outline: "none",
  caretColor: "var(--cog-gold)",
  boxSizing: "border-box",
  resize: "none",
};

const GuidedShapeRail = ({
  songTitle,
  canCommit,
  committing = false,
  hasWords = false,
  heardSections = [],
  homeSongs = [],
  onCommitToSong,
  onAddLyrics,
  onSetSection,
  onAddChords,
  onCommit,
  onKeepLoose,
  onDismiss,
}: GuidedShapeRailProps) => {
  const [step, setStep] = useState(0);
  const [lyrics, setLyrics] = useState("");
  const [chords, setChords] = useState("");
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const addLyrics = () => {
    const t = lyrics.trim();
    if (t) onAddLyrics(t);
    setLyrics("");
    next();
  };
  const addChords = () => {
    const t = chords.trim();
    if (t) onAddChords(t);
    setChords("");
    next();
  };

  const question = (text: string) => (
    <p
      style={{
        margin: "0 0 10px",
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 700,
        lineHeight: 1.25,
        color: "var(--cog-charcoal)",
      }}
    >
      {text}
    </p>
  );

  const actions = (opts: { canAdd?: boolean; onAdd?: () => void; addLabel?: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      {step > 0 && (
        <button type="button" onClick={back} style={ghostBtn} aria-label="Back to the previous step">
          <ArrowLeft size={15} strokeWidth={2.2} />
        </button>
      )}
      <button type="button" onClick={next} style={{ ...ghostBtn, flex: 1 }}>
        Skip
      </button>
      {opts.onAdd && (
        <button
          type="button"
          onClick={opts.onAdd}
          disabled={!opts.canAdd}
          style={{ ...goldBtn, flex: 2, justifyContent: "center", opacity: opts.canAdd ? 1 : 0.5 }}
        >
          {opts.addLabel ?? "Add"}
          <ArrowRight size={15} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );

  return (
    <section
      aria-label="Shape this idea, step by step"
      style={{
        position: "relative",
        borderRadius: 18,
        marginBottom: 14,
        background: "linear-gradient(150deg, #FFFFFF 0%, #FFFBF2 100%)",
        border: "1.5px solid rgba(184,149,58,0.30)",
        boxShadow: "0 10px 28px rgba(184,149,58,0.12)",
        padding: "14px 16px 14px",
        overflow: "hidden",
      }}
    >
      {/* Eyebrow + progress dots + the way out (the guide, never a cage). */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p
          style={{
            margin: 0,
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--cog-gold)",
          }}
        >
          Shape it · {step + 1} of {STEPS.length}
        </p>
        <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              style={{
                width: i === step ? 16 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: i <= step ? "var(--cog-gold)" : "rgba(28,26,23,0.12)",
                transition: reduce ? "none" : `all 260ms ${EASE}`,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close the guide and edit everything yourself"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "none",
            backgroundColor: "rgba(28,26,23,0.05)",
            color: "var(--cog-warm-gray)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      {/* One step mounted at a time — off-screen carousel panels would leak
          into the accessibility tree (Tab could reach hidden Skips). A keyed
          rise keeps the continuity; reduced motion renders instantly. */}
      <style>{`@keyframes cog-shape-step { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div
        key={step}
        style={{ animation: reduce ? "none" : `cog-shape-step 240ms ${EASE}` }}
      >
        {STEPS[step] === "lyrics" && (
          <div>
            {question("What words go with it?")}
            {hasWords && (
              <p style={{ margin: "-4px 0 8px", fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                Your spoken words are already below — add more, or skip.
              </p>
            )}
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Write the line you were singing…"
              aria-label="Lyrics for this idea"
              rows={3}
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              style={fieldStyle}
            />
            {actions({ canAdd: lyrics.trim().length > 0, onAdd: addLyrics, addLabel: "Add lyrics" })}
          </div>
        )}

        {STEPS[step] === "section" && (
          <div>
            {question("Which part of the song is this?")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SECTION_CHIPS.map((c) => {
                const heard = heardSections.includes(c.kind);
                return (
                  <button
                    key={c.kind}
                    type="button"
                    onClick={() => {
                      // A part the take already holds just advances — tapping
                      // "Chorus" twice must never duplicate the section.
                      if (!heard) onSetSection(c.kind, c.label);
                      next();
                    }}
                    aria-label={heard ? `${c.label} — already in this take` : c.label}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 999,
                      border: heard ? "1.5px solid var(--cog-gold)" : "1.5px solid rgba(184,149,58,0.35)",
                      backgroundColor: heard ? "var(--cog-gold)" : "var(--cog-gold-pale, #E8D5A0)",
                      color: heard ? "#FFFFFF" : "var(--cog-charcoal)",
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {heard && <Check size={13} strokeWidth={3} />}
                    {c.label}
                  </button>
                );
              })}
            </div>
            {actions({})}
          </div>
        )}

        {STEPS[step] === "chords" && (
          <div>
            {question("Any chords underneath it?")}
            <input
              value={chords}
              onChange={(e) => setChords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chords.trim()) {
                  e.preventDefault();
                  addChords();
                }
              }}
              placeholder="C  G  Am  F"
              aria-label="Chords for this idea"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{ ...fieldStyle, fontFamily: "var(--font-body)" }}
            />
            {actions({ canAdd: chords.trim().length > 0, onAdd: addChords, addLabel: "Add chords" })}
          </div>
        )}

        {STEPS[step] === "home" && (
          <div>
            {question("Where should this idea live?")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {canCommit && (
                <button
                  type="button"
                  onClick={onCommit}
                  disabled={committing}
                  style={{ ...goldBtn, width: "100%", minHeight: 50, justifyContent: "center", opacity: committing ? 0.7 : 1 }}
                >
                  <Check size={16} strokeWidth={2.4} />
                  {committing ? "Adding…" : `Add to ${songTitle ?? "the song"}`}
                </button>
              )}
              {/* Song-less capture: the writer's own songs, one tap to file —
                  inline (never a second sheet stacked over this one). */}
              {!canCommit && onCommitToSong && homeSongs.length > 0 && (
                <div
                  role="list"
                  aria-label="File this idea into one of your songs"
                  style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}
                >
                  {homeSongs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onCommitToSong(s.id)}
                      disabled={committing}
                      aria-label={`Add this idea to ${s.title}`}
                      style={{
                        minHeight: 48,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1.5px solid rgba(184,149,58,0.30)",
                        backgroundColor: "#FFFFFF",
                        color: "var(--cog-charcoal)",
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        textAlign: "left",
                        opacity: committing ? 0.6 : 1,
                      }}
                    >
                      <ArrowRight size={15} strokeWidth={2.2} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onKeepLoose}
                style={{ ...ghostBtn, width: "100%", minHeight: 48, textAlign: "center" }}
              >
                {/* Honesty per context: in a song, the take is ALREADY attached
                    to it — "keep it in my ideas" would be a lie there. */}
                {canCommit ? "Finish shaping it later" : "Keep it loose in my ideas for now"}
              </button>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--cog-muted)", fontFamily: "var(--font-body)", textAlign: "center" }}>
                Either way, the recording is already safe.
              </p>
            </div>
            <div style={{ display: "flex", marginTop: 10 }}>
              <button type="button" onClick={back} style={ghostBtn} aria-label="Back to the previous step">
                <ArrowLeft size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default GuidedShapeRail;
