import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RailAction } from "./SideRail";
import ScripturePicker from "./ScripturePicker";
import ChordPicker, { type ChordPickerSongWiring } from "./ChordPicker";

export type PendingBlockKind = "lyrics" | "chords" | "scripture" | "idea" | "section";

export type PendingBlock = {
  id: string;
  kind: PendingBlockKind;
  section_kind: string | null;
  label: string;
  text: string;
  /** ms offset within the most recent take. null = standalone (no recording). */
  start_ms: number | null;
  end_ms: number | null;
};

interface CaptureSheetProps {
  open: boolean;
  action: RailAction | null;
  onClose: () => void;
  onSave: (block: PendingBlock) => void;
  /**
   * Song-level key/BPM wiring for the chord picker (initial values, F13
   * detected suggestion, persistence callbacks). Absent on the global
   * capture page — the picker then behaves exactly as before.
   */
  chords?: ChordPickerSongWiring;
}

const SECTION_KINDS: { value: string; label: string }[] = [
  { value: "verse", label: "Verse" },
  { value: "pre-chorus", label: "Pre-Chorus" },
  { value: "chorus", label: "Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "tag", label: "Tag" },
  { value: "outro", label: "Outro" },
];

const COPY: Record<RailAction, { title: string; description: string; placeholder: string }> = {
  lyrics:    { title: "Add lyrics",   description: "Type or paste the line you just heard.",            placeholder: "We were dead in our sin…" },
  chords:    { title: "Add chords",   description: "Key, BPM, and the progression you're hearing.",     placeholder: "Key: G · 92 BPM · I–V–vi–IV" },
  section:   { title: "Mark a section", description: "Name the part you're working on.",                placeholder: "Verse 1 — opening lines" },
  scripture: { title: "Add scripture", description: "Reference and the verse text or paraphrase.",      placeholder: "Psalm 23:1 — The Lord is my shepherd…" },
  note:      { title: "Capture an idea", description: "Anything you want to remember about this song.", placeholder: "Could end on a tag that repeats the hook" },
};

/**
 * Generic bottom sheet used by every side-rail chip. Stores the entry as a
 * "pending block" that flows into the Review Sheet when the user stops recording.
 */
const CaptureSheet = ({ open, action, onClose, onSave, chords }: CaptureSheetProps) => {
  const [text, setText] = useState("");
  const [sectionKind, setSectionKind] = useState<string>("verse");
  const [sectionNum, setSectionNum] = useState<string>("");
  const [scriptureFallback, setScriptureFallback] = useState(false);
  const [chordsFallback, setChordsFallback] = useState(false);
  // How many px the on-screen keyboard overlaps the bottom of the viewport. On
  // iOS Safari the software keyboard covers a bottom-anchored sheet without any
  // reflow, hiding the Save/Cancel buttons behind it. We track visualViewport
  // and pad the sheet's scroll area by that inset so the actions always clear
  // the keyboard — the single most-felt fix for typing lyrics on a phone.
  const [kbInset, setKbInset] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setSectionKind("verse");
      setSectionNum("");
      setScriptureFallback(false);
      setChordsFallback(false);
      // Focus on next tick so the sheet animation doesn't fight the keyboard.
      setTimeout(() => {
        if (action !== "scripture") inputRef.current?.focus();
      }, 80);
    }
  }, [open, action]);

  useEffect(() => {
    if (!open) {
      setKbInset(0);
      return;
    }
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      // Gap between the layout viewport bottom and the visual viewport bottom =
      // the keyboard (plus any bottom browser chrome). Clamp tiny values to 0.
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset > 24 ? inset : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  if (!action) return null;
  const copy = COPY[action];
  const useScripturePicker = action === "scripture" && !scriptureFallback;
  const useChordPicker = action === "chords" && !chordsFallback;

  const handleSave = () => {
    const trimmed = text.trim();
    if (action !== "section" && trimmed.length === 0) return;

    let label = "";
    let blockKind: PendingBlockKind = action === "note" ? "idea" : (action as PendingBlockKind);
    let section_kind: string | null = null;

    if (action === "section") {
      const base = SECTION_KINDS.find((s) => s.value === sectionKind)?.label ?? "Section";
      label = sectionNum ? `${base} ${sectionNum}` : base;
      section_kind = sectionKind;
      blockKind = "section";
    } else if (action === "lyrics") {
      label = "Lyrics";
    } else if (action === "chords") {
      label = "Chords";
    } else if (action === "scripture") {
      label = "Scripture";
    } else {
      label = "Idea";
    }

    onSave({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: blockKind,
      section_kind,
      label,
      text: trimmed,
      start_ms: null,
      end_ms: null,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t"
        style={{
          background: "var(--cog-cream-light, #faf7f2)",
          borderColor: "rgba(184,149,58,0.30)",
          maxHeight: "88dvh",
          overflowY: "auto",
          // The sheet is pinned to the screen bottom, so padding here grows it
          // UPWARD — lifting Save/Cancel clear of the keyboard. Scrolls if the
          // lifted content ever exceeds the sheet height.
          paddingBottom: kbInset ? kbInset + 12 : undefined,
          transition: "padding-bottom 180ms ease",
        }}
      >
        <SheetHeader className="text-left">
          <SheetTitle style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
            {copy.title}
          </SheetTitle>
          <SheetDescription style={{ color: "var(--cog-warm-gray)" }}>
            {copy.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 mt-4">
          {useScripturePicker && (
            <ScripturePicker
              onPicked={(label, scriptureText) => {
                onSave({
                  id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  kind: "scripture",
                  section_kind: null,
                  label,
                  text: scriptureText,
                  start_ms: null,
                  end_ms: null,
                });
                onClose();
              }}
              onFallback={() => setScriptureFallback(true)}
            />
          )}

          {useChordPicker && (
            <>
              <ChordPicker
                {...(chords ?? {})}
                onSave={(label, lettersText) => {
                  onSave({
                    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    kind: "chords",
                    section_kind: null,
                    label,
                    text: lettersText,
                    start_ms: null,
                    end_ms: null,
                  });
                  onClose();
                }}
              />
              <button
                type="button"
                onClick={() => setChordsFallback(true)}
                className="text-xs self-center"
                style={{ color: "var(--cog-warm-gray)", minHeight: 44, padding: "0 16px" }}
              >
                Type freeform instead
              </button>
            </>
          )}

          {!useScripturePicker && !useChordPicker && (
            <>
          {action === "section" && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sectionKind}
                onChange={(e) => setSectionKind(e.target.value)}
                className="rounded-xl border px-3 py-2 bg-white"
                style={{ borderColor: "var(--cog-border)", fontSize: 16 }}
              >
                {SECTION_KINDS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <Input
                inputMode="numeric"
                placeholder="# (optional)"
                value={sectionNum}
                onChange={(e) => setSectionNum(e.target.value.replace(/\D/g, "").slice(0, 2))}
                style={{ fontSize: 16 }}
              />
            </div>
          )}

          <Textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={copy.placeholder}
            rows={action === "lyrics" || action === "scripture" ? 5 : 3}
            // A lyric / idea / chord line is not prose — no autocorrect or
            // spellcheck mangling the songwriter's exact words. 16px so iOS Safari
            // never zooms the sheet the instant this field is focused.
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="resize-none"
            style={{ fontSize: 16 }}
          />

          <Button
            type="button"
            onClick={handleSave}
            disabled={action !== "section" && text.trim().length === 0}
            className="w-full h-12 rounded-2xl text-base font-semibold disabled:cursor-not-allowed"
            style={{
              background: "var(--cog-gold)",
              color: "var(--cog-cream-light, #faf7f2)",
              opacity: action !== "section" && text.trim().length === 0 ? 0.5 : 1,
            }}
          >
            {/* Honest with the first-timer: this sheet only opens BEFORE a take
                exists (rail taps during a recording drop pins directly), so the
                old "Save to take" promised a take that isn't there yet. "Keep
                this" is true in every case; the save toast explains it waits for
                the next recording. */}
            Keep this
          </Button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-sm self-center"
            style={{ color: "var(--cog-warm-gray)", minHeight: 44, padding: "0 20px" }}
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CaptureSheet;