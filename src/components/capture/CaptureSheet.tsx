import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RailAction } from "./SideRail";
import ScripturePicker from "./ScripturePicker";
import ChordPicker from "./ChordPicker";

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
const CaptureSheet = ({ open, action, onClose, onSave }: CaptureSheetProps) => {
  const [text, setText] = useState("");
  const [sectionKind, setSectionKind] = useState<string>("verse");
  const [sectionNum, setSectionNum] = useState<string>("");
  const [scriptureFallback, setScriptureFallback] = useState(false);
  const [chordsFallback, setChordsFallback] = useState(false);
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
          maxHeight: "82dvh",
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
                style={{ color: "var(--cog-warm-gray)" }}
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
                className="rounded-xl border px-3 py-2 text-sm bg-white"
                style={{ borderColor: "var(--cog-border)" }}
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
              />
            </div>
          )}

          <Textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={copy.placeholder}
            rows={action === "lyrics" || action === "scripture" ? 5 : 3}
            className="resize-none"
          />

          <Button
            type="button"
            onClick={handleSave}
            className="w-full h-12 rounded-2xl text-base font-semibold"
            style={{
              background: "var(--cog-gold)",
              color: "var(--cog-cream-light, #faf7f2)",
            }}
          >
            Save to take
          </Button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-sm py-2"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CaptureSheet;