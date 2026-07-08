import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Crown, Guitar, Hash, Minus,
  MoreHorizontal, Music, Pencil, Play, Plus, Printer, Ruler, Share2, Trash2, Type, Wand2, X,
} from "lucide-react";
import { useSongTitle } from "@/lib/songContext";
import { useSongSheet } from "@/lib/sheet/useSongSheet";
import { emitSheetEvent } from "@/integrations/cog/sheet";
import {
  type SheetDoc,
  type SheetSectionDoc,
  type SheetLineDoc,
  type SheetEventDraft,
  addLine,
  addSection,
  docFromChordPro,
  docToChordPro,
  docToSections,
  editLineText,
  newSheetId,
  removeChordAnchor,
  removeSection,
  renameSection,
  reorderSection,
  setChordAnchor,
} from "@/lib/chords/sheetState";
import {
  renderChordsOverLyrics,
  transposeKeyLetter,
  type SheetSection,
} from "@/lib/chords/sheet";
import { chordToLetters, type NumberChord } from "@/lib/chords/nashville";
import { MAJOR_KEYS } from "@/lib/chords/keys";
import ChordLine from "@/components/songsheet/ChordLine";
import PerformanceView from "@/components/songsheet/PerformanceView";
import ChordPlaceSheet from "@/components/songsheet/ChordPlaceSheet";
import ChordDiagramSheet from "@/components/songsheet/ChordDiagramSheet";
import { useDialogDismiss } from "@/components/songsheet/useDialogDismiss";
import { countLineSyllables } from "@/lib/lyrics/syllables";
import { rhymeScheme } from "@/lib/lyrics/rhyme";
import { looksLikeChordsOverLyrics, chordsOverLyricsToChordPro } from "@/lib/chords/importChart";
import { suggestCapos } from "@/lib/chords/capoSuggest";

/**
 * The Lyrics & Chords editor (C3) — the structured, performable lyric & chord
 * sheet at /songs/:id/lyrics · /chords · /sheet. Source of truth is a SheetDoc
 * mutated only through sheetState ops (which emit contract events); persistence
 * flows through the cog/sheet seam with the database as the record and
 * localStorage as an offline cache. Transpose/capo are view-only and never
 * touch stored anchors. Lyric bodies render in Inter; only the title and the
 * print header use Playfair.
 *
 * Suggestion seam (F19, D3's lane): every rendered lyric line is wrapped in a
 * container carrying data-cog-line-id + data-cog-section-id — the stable mount
 * point Collaboration attaches propose/accept/reject UI to. C3 builds none of
 * that machinery.
 */

const SAMPLE = [
  "{start_of_verse: Verse 1}",
  "[C]Lord I [G]wait for [Am]You",
  "In the [F]stillness [C]I am [G]found",
  "{start_of_chorus: Chorus}",
  "[F]You are the [C]anchor [G]of my [Am]song",
  "[F]Colors of [C]glory [G]all a[Am]long",
].join("\n");

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const SECTION_VOCAB = ["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Tag", "Outro", "Interlude", "Hook"];

type OpResult = { doc: SheetDoc; event: SheetEventDraft | null };
type Placing = { sectionId: string; lineId: string; at: number; word: string; current?: NumberChord };

/** Single-splice diff between two strings (common prefix/suffix), for editLineText. */
function spliceDiff(before: string, after: string) {
  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  return { start, deleteCount: endB - start, insertCount: endA - start, newText: after };
}

const SongSheetPage = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "";
  const navigate = useNavigate();
  const songTitle = useSongTitle(songId);
  const { doc, setDoc, loadState, saveState } = useSongSheet(songId);

  // View-only state — transposition/capo/display change how the doc RENDERS,
  // never the doc itself (the non-destructive guarantee), so none of these
  // dirty the doc or trigger a save.
  const [displayKey, setDisplayKey] = useState("C");
  const [capo, setCapo] = useState(0);
  const [display, setDisplay] = useState<"letters" | "numbers">("letters");
  const [showSyllables, setShowSyllables] = useState(false);
  const [tab, setTab] = useState<"lyrics" | "chords">("lyrics");
  const [craft, setCraft] = useState(false);
  const [perform, setPerform] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SheetSectionDoc | null>(null);
  const [copied, setCopied] = useState(false);

  const initializedKeyFor = useRef<string | null>(null);
  useEffect(() => {
    if (doc && initializedKeyFor.current !== songId) {
      initializedKeyFor.current = songId;
      setDisplayKey(doc.key);
      setCapo(doc.capo);
      setDisplay(doc.display);
    }
  }, [doc, songId]);

  const apply = (r: OpResult) => setDoc(r.doc, [r.event]);

  const sourceKey = doc?.key ?? "C";
  const sections = useMemo(() => (doc ? docToSections(doc) : []), [doc]);
  const isEmpty = !doc || doc.sections.length === 0;

  const stepKey = (s: number) => {
    setDisplayKey((k) => {
      const next = transposeKeyLetter(k, "major", s);
      // View-only, but the contract still hears about it (quiet event).
      void emitSheetEvent(songId, {
        type: "key_changed",
        entity: { type: "song", id: songId },
        payload: { fromKey: k, toKey: next, capo, display, nonDestructive: true },
      });
      return next;
    });
  };

  const playKey = capo > 0 ? transposeKeyLetter(displayKey, "major", -capo) : displayKey;

  const capoHints = useMemo(() => {
    const s = suggestCapos(displayKey, "major");
    return s.length && s[0].capo === 0 ? [] : s;
  }, [displayKey]);

  const uniqueChords = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const section of sections) {
      for (const line of section.lines) {
        for (const a of line.anchors) {
          const label = chordToLetters(a.chord, playKey, "major");
          if (!seen.has(label)) {
            seen.add(label);
            list.push(label);
          }
        }
      }
    }
    return list;
  }, [sections, playKey]);

  // ── Structured ops ─────────────────────────────────────────────────────────
  const handleAddSection = (label: string) => {
    if (!doc && loadState === "ready") {
      // First section of a blank song: create the doc, then the section.
      const fresh = docFromChordPro({ songId, key: "C" }, "");
      const a = addSection(fresh, { id: newSheetId(), label });
      const b = addLine(a.doc, a.doc.sections[a.doc.sections.length - 1].id, { id: newSheetId() });
      setDoc(b.doc, [a.event, b.event]);
    } else if (doc) {
      const a = addSection(doc, { id: newSheetId(), label: autoOrdinal(doc, label) });
      const b = addLine(a.doc, a.doc.sections[a.doc.sections.length - 1].id, { id: newSheetId() });
      setDoc(b.doc, [a.event, b.event]);
    }
    setAddSectionOpen(false);
  };

  const handleRename = (sectionId: string, to: string) => {
    if (doc && to.trim()) apply(renameSection(doc, sectionId, to.trim()));
  };
  const handleMove = (sectionId: string, delta: number) => {
    if (!doc) return;
    const idx = doc.sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    apply(reorderSection(doc, sectionId, idx + delta));
  };
  const handleRemove = (section: SheetSectionDoc) => {
    const hasContent = section.lines.some((l) => l.text.trim() !== "");
    if (hasContent) setConfirmRemove(section);
    else if (doc) apply(removeSection(doc, section.id));
  };
  const handleLineCommit = (sectionId: string, lineId: string, before: string, after: string) => {
    if (!doc || before === after) return;
    apply(editLineText(doc, sectionId, lineId, spliceDiff(before, after)));
  };
  const handleAddLine = (sectionId: string) => {
    if (doc) apply(addLine(doc, sectionId, { id: newSheetId() }));
  };
  const handlePick = (chord: NumberChord) => {
    if (doc && placing) apply(setChordAnchor(doc, placing.sectionId, placing.lineId, chord, placing.at));
    setPlacing(null);
  };
  const handleRemoveChord = () => {
    if (doc && placing) apply(removeChordAnchor(doc, placing.sectionId, placing.lineId, placing.at));
    setPlacing(null);
  };
  const handleImport = (source: string, key: string) => {
    // Bulk import replaces the doc (fresh line identity — the textarea is a
    // power-user affordance, not the primary editing path).
    const next = docFromChordPro({ songId, key, display }, source);
    setDoc({ ...next, bpm: doc?.bpm }, []);
    setDisplayKey(key);
    setImportOpen(false);
  };

  const copyChordPro = async () => {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(docToChordPro(doc, displayKey));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; silently no-op */
    }
  };

  const shareSheet = async () => {
    if (!doc) return;
    const text = docToChordPro(doc, displayKey);
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: songTitle, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user cancelled or unsupported — fine */
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 120 }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 85%, var(--cog-gold-glow) 0%, transparent 65%)" }}
      />

      {/* ── Top chrome: back · crown · ⋯ ─────────────────────────────────── */}
      <div
        className="relative flex items-center justify-between px-3 pt-12 pb-1"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <button
          type="button"
          onClick={() => navigate(`/songs/${songId}`)}
          aria-label="Back to song"
          className="flex items-center justify-center rounded-full active:scale-90"
          style={{ width: 44, height: 44, color: "var(--cog-warm-gray)" }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <Crown size={22} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
        <button
          type="button"
          onClick={() => setToolsOpen(true)}
          aria-label="Sheet tools"
          aria-haspopup="dialog"
          className="flex items-center justify-center rounded-full active:scale-90"
          style={{ width: 44, height: 44, color: "var(--cog-warm-gray)" }}
        >
          <MoreHorizontal size={22} strokeWidth={2} />
        </button>
      </div>

      <div className="relative flex flex-col flex-1" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}>
        {/* Song title — left-aligned workspace mode, Playfair */}
        <h1
          className="px-5"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cog-charcoal)", fontSize: 28, lineHeight: 1.15 }}
        >
          {songTitle || "Untitled song"}
        </h1>

        {/* Save indicator — quiet, honest, never red */}
        <p className="px-5 mt-0.5 text-xs" style={{ color: "var(--cog-muted)", minHeight: 16, fontFamily: "var(--font-body)" }} aria-live="polite">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1">
              <Check size={11} strokeWidth={2.4} /> Saved
            </span>
          )}
          {saveState === "offline" && "Offline — changes will sync"}
          {saveState === "idle" && !isEmpty && `Key of ${displayKey}${capo > 0 ? ` · Capo ${capo} (play ${playKey})` : ""}`}
        </p>

        {/* ── Tab bar: Lyrics · Chords (owned) / Voice · Notes (navigation) ── */}
        <nav className="flex items-end gap-6 px-5 mt-3" aria-label="Song sheet views" style={{ borderBottom: "1px solid var(--cog-border)" }}>
          {([
            ["lyrics", "Lyrics"],
            ["chords", "Chords"],
            ["voice", "Voice"],
            ["notes", "Notes"],
          ] as const).map(([key, label]) => {
            const active = (key === "lyrics" && tab === "lyrics") || (key === "chords" && tab === "chords");
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "voice") navigate(`/songs/${songId}/voice`);
                  else if (key === "notes") navigate(`/songs/${songId}/notes`);
                  else {
                    setTab(key);
                    setCraft(false);
                  }
                }}
                aria-current={active ? "page" : undefined}
                className="pb-2.5 text-sm font-medium"
                style={{
                  fontFamily: "var(--font-body)",
                  color: active ? "var(--cog-charcoal)" : "var(--cog-muted)",
                  borderBottom: active ? "2px solid var(--cog-gold)" : "2px solid transparent",
                  minHeight: 44,
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 pt-5 flex-1">
          {loadState === "loading" ? (
            <SheetLoading />
          ) : loadState === "error" ? (
            <SheetError onRetry={() => window.location.reload()} />
          ) : isEmpty ? (
            <SheetEmptyState
              onAddSection={() => setAddSectionOpen(true)}
              onPaste={() => setImportOpen(true)}
              onExample={() => setDoc(docFromChordPro({ songId, key: "C" }, SAMPLE), [])}
            />
          ) : (
            <>
              {/* Chords in this song — tap for a fingering diagram */}
              {uniqueChords.length > 0 && (
                <div className="mb-5">
                  <SectionLabel>Chords</SectionLabel>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 mt-1.5" style={{ scrollbarWidth: "none" }}>
                    {uniqueChords.map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setDiagram(lbl)}
                        className="shrink-0 inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-transform active:scale-95"
                        style={{
                          minWidth: 46,
                          minHeight: 40,
                          padding: "0 12px",
                          backgroundColor: "var(--cog-gold-pale)",
                          color: "var(--cog-charcoal)",
                          border: "1px solid rgba(184,149,58,0.3)",
                        }}
                        aria-label={`${lbl} chord — show fingering`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === "chords" && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 mb-5"
                  style={{ backgroundColor: "rgba(184,149,58,0.10)", border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))" }}
                >
                  <span className="text-xs" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    Tap a word to place a chord over it.
                  </span>
                </div>
              )}

              {craft ? (
                <CraftView sections={sections} />
              ) : (
                <div className="flex flex-col gap-7">
                  {doc!.sections.map((section, si) => (
                    <SectionView
                      key={section.id}
                      section={section}
                      index={si}
                      count={doc!.sections.length}
                      mode={tab}
                      displayKey={playKey}
                      sourceKey={sourceKey}
                      display={display}
                      showSyllables={showSyllables}
                      onRename={handleRename}
                      onMove={handleMove}
                      onRemove={handleRemove}
                      onLineCommit={handleLineCommit}
                      onAddLine={handleAddLine}
                      onTapWord={(lineId, at, word, current) => setPlacing({ sectionId: section.id, lineId, at, word, current })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Fixed bottom bar: Add section · Record idea ─────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 flex gap-2.5 px-5 pt-3"
        style={{
          maxWidth: "var(--max-w-app)",
          margin: "0 auto",
          paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
          backgroundColor: "rgba(245,240,232,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--cog-border)",
          zIndex: 40,
        }}
      >
        <button
          type="button"
          onClick={() => setAddSectionOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-transform active:scale-[0.97]"
          style={{ minHeight: 44, backgroundColor: "var(--cog-cream-dark)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          <Plus size={15} strokeWidth={2.2} /> Add section
        </button>
        <button
          type="button"
          onClick={() => navigate(`/songs/${songId}/capture`)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-transform active:scale-[0.97]"
          style={{ minHeight: 44, backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)" }}
        >
          <Music size={15} strokeWidth={2.2} /> Record idea
        </button>
      </div>

      {/* ── Sheets & overlays ────────────────────────────────────────────── */}
      {toolsOpen && (
        <ToolsSheet
          onClose={() => setToolsOpen(false)}
          displayKey={displayKey}
          display={display}
          capo={capo}
          capoHints={capoHints}
          showSyllables={showSyllables}
          craft={craft}
          copied={copied}
          disabled={isEmpty}
          onStepKey={stepKey}
          onDisplay={setDisplay}
          onCapo={setCapo}
          onSyllables={() => setShowSyllables((s) => !s)}
          onCraft={() => {
            setCraft((c) => !c);
            setToolsOpen(false);
          }}
          onPerform={() => {
            setToolsOpen(false);
            setPerform(true);
          }}
          onImport={() => {
            setToolsOpen(false);
            setImportOpen(true);
          }}
          onCopy={copyChordPro}
          onPrint={() => window.print()}
          onShare={shareSheet}
        />
      )}

      {addSectionOpen && <AddSectionSheet onPick={handleAddSection} onClose={() => setAddSectionOpen(false)} />}

      {importOpen && (
        <ImportSheet
          initialSource={doc ? docToChordPro(doc, sourceKey) : ""}
          initialKey={sourceKey}
          onDone={handleImport}
          onClose={() => setImportOpen(false)}
        />
      )}

      {confirmRemove && (
        <ConfirmRemoveSheet
          section={confirmRemove}
          onConfirm={() => {
            if (doc) apply(removeSection(doc, confirmRemove.id));
            setConfirmRemove(null);
          }}
          onClose={() => setConfirmRemove(null)}
        />
      )}

      {perform && doc && (
        <PerformanceView
          sections={sections}
          displayKey={playKey}
          display={display}
          capo={capo}
          songTitle={songTitle}
          onClose={() => setPerform(false)}
        />
      )}

      {placing && (
        <ChordPlaceSheet
          word={placing.word}
          currentLabel={placing.current ? chordToLetters(placing.current, sourceKey) : undefined}
          sourceKey={sourceKey}
          mode="major"
          onPick={handlePick}
          onRemove={handleRemoveChord}
          onClose={() => setPlacing(null)}
        />
      )}

      {diagram && <ChordDiagramSheet label={diagram} onClose={() => setDiagram(null)} />}

      {/* Print / PDF — hidden on screen, the only thing visible when printing */}
      {!isEmpty && (
        <PrintSheet songTitle={songTitle} sections={sections} playKey={playKey} display={display} capo={capo} />
      )}
      <style>{`
        .cog-print { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .cog-print, .cog-print * { visibility: visible !important; }
          .cog-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 24px; color: #000; background: #fff; }
          .cog-print h1 { font-size: 20pt; margin: 0 0 2px; font-family: var(--font-display); }
          .cog-print .cog-print-sub { font-size: 10pt; color: #444; margin: 0 0 14px; }
          .cog-print h2 { font-size: 12pt; margin: 12px 0 4px; font-family: var(--font-display); }
          .cog-print pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5pt; line-height: 1.5; margin: 0 0 2px; white-space: pre-wrap; }
          .cog-print section { break-inside: avoid; margin-bottom: 8px; }
        }
        .cog-sheet-up { animation: cog-sheet-up 280ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)); }
        @keyframes cog-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .cog-sheet-up { animation: none; } }
      `}</style>
    </div>
  );
};

/** "Verse" → "Verse 2" when a Verse already exists; labels with digits pass through. */
function autoOrdinal(doc: SheetDoc, label: string): string {
  if (/\d/.test(label)) return label;
  const same = doc.sections.filter((s) => s.label.replace(/\s*\d+$/, "").toLowerCase() === label.toLowerCase()).length;
  if (same === 0) return label;
  return `${label} ${same + 1}`;
}

// ─── Section (memoized — only the edited section re-renders) ─────────────────

const SectionView = memo(function SectionView({
  section,
  index,
  count,
  mode,
  displayKey,
  sourceKey,
  display,
  showSyllables,
  onRename,
  onMove,
  onRemove,
  onLineCommit,
  onAddLine,
  onTapWord,
}: {
  section: SheetSectionDoc;
  index: number;
  count: number;
  mode: "lyrics" | "chords";
  displayKey: string;
  sourceKey: string;
  display: "letters" | "numbers";
  showSyllables: boolean;
  onRename: (sectionId: string, to: string) => void;
  onMove: (sectionId: string, delta: number) => void;
  onRemove: (section: SheetSectionDoc) => void;
  onLineCommit: (sectionId: string, lineId: string, before: string, after: string) => void;
  onAddLine: (sectionId: string) => void;
  onTapWord: (lineId: string, at: number, word: string, current?: NumberChord) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(section.label);

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        {renaming ? (
          <input
            autoFocus
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              onRename(section.id, draftLabel);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraftLabel(section.label);
                setRenaming(false);
              }
            }}
            aria-label="Section name"
            className="rounded-lg px-2 py-1 outline-none text-[0.8125rem] font-medium uppercase"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--cog-charcoal)",
              letterSpacing: "0.08em",
              backgroundColor: "#fff",
              border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))",
              maxWidth: 180,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftLabel(section.label);
              setRenaming(true);
            }}
            aria-label={`Rename section ${section.label || "untitled"}`}
            className="text-left active:opacity-60"
            style={{ minHeight: 32 }}
          >
            <SectionLabel>{section.label || "Untitled"}</SectionLabel>
          </button>
        )}
        <span className="flex-1" />
        <IconGhost label={`Move ${section.label} up`} disabled={index === 0} onClick={() => onMove(section.id, -1)}>
          <ChevronUp size={15} strokeWidth={2} />
        </IconGhost>
        <IconGhost label={`Move ${section.label} down`} disabled={index === count - 1} onClick={() => onMove(section.id, 1)}>
          <ChevronDown size={15} strokeWidth={2} />
        </IconGhost>
        <IconGhost label={`Remove ${section.label}`} onClick={() => onRemove(section)}>
          <Trash2 size={14} strokeWidth={2} />
        </IconGhost>
      </div>

      <div className="flex flex-col gap-3">
        {section.lines.map((line) => (
          // The line wrapper is the F19 suggestion mount point: stable line id
          // + section id, so Collaboration can key suggestion UI to this line.
          <div key={line.id} data-cog-line-id={line.id} data-cog-section-id={section.id}>
            {mode === "chords" ? (
              <EditableLine line={line} sourceKey={sourceKey} onTapWord={(at, word, current) => onTapWord(line.id, at, word, current)} />
            ) : (
              <LyricLine
                line={line}
                displayKey={displayKey}
                display={display}
                showSyllables={showSyllables}
                onCommit={(after) => onLineCommit(section.id, line.id, line.text, after)}
              />
            )}
          </div>
        ))}
        {mode === "lyrics" && (
          <button
            type="button"
            onClick={() => onAddLine(section.id)}
            className="self-start text-xs font-medium active:opacity-60"
            style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)", minHeight: 32 }}
          >
            + Add a line
          </button>
        )}
      </div>
    </section>
  );
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="uppercase"
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: "0.8125rem",
        color: "var(--cog-muted)",
        letterSpacing: "0.12em",
      }}
    >
      {children}
    </h2>
  );
}

function IconGhost({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center rounded-lg active:scale-90 disabled:opacity-25"
      style={{ width: 32, height: 32, color: "var(--cog-muted)" }}
    >
      {children}
    </button>
  );
}

// ─── Lyric line: read + tap-to-edit (Inter body, always) ────────────────────

function LyricLine({
  line,
  displayKey,
  display,
  showSyllables,
  onCommit,
}: {
  line: SheetLineDoc;
  displayKey: string;
  display: "letters" | "numbers";
  showSyllables: boolean;
  onCommit: (after: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(line.text);
            setEditing(false);
          }
        }}
        aria-label="Edit lyric line"
        className="w-full rounded-lg px-2 py-1.5 outline-none"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.9375rem",
          color: "var(--cog-charcoal)",
          backgroundColor: "#fff",
          border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))",
        }}
      />
    );
  }

  return (
    <div className="flex items-end gap-3">
      <button
        type="button"
        onClick={() => {
          setDraft(line.text);
          setEditing(true);
        }}
        className="flex-1 text-left active:opacity-70"
        aria-label={line.text.trim() ? `Edit line: ${line.text}` : "Edit empty line"}
        style={{ minHeight: line.text.trim() || line.anchors.length ? undefined : 28 }}
      >
        <ChordLine line={line} displayKey={displayKey} display={display} />
      </button>
      {showSyllables && line.text.trim() && (
        <span
          className="text-[0.6875rem] font-medium tabular-nums mb-0.5 flex-shrink-0"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
          aria-label={`${countLineSyllables(line.text)} syllables`}
        >
          {countLineSyllables(line.text)}
        </span>
      )}
    </div>
  );
}

// ─── Chord-placement line (Chords tab) ───────────────────────────────────────

function EditableLine({
  line,
  sourceKey,
  onTapWord,
}: {
  line: SheetLineDoc;
  sourceKey: string;
  onTapWord: (at: number, word: string, current?: NumberChord) => void;
}) {
  const words = [...line.text.matchAll(/\S+/g)];
  if (words.length === 0) return <div style={{ height: 6 }} />;
  return (
    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
      {words.map((m, i) => {
        const start = m.index ?? 0;
        const text = m[0];
        const end = start + text.length;
        const anchor = line.anchors.find((a) => a.at >= start && a.at < end);
        const label = anchor ? chordToLetters(anchor.chord, sourceKey) : null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTapWord(anchor?.at ?? start, text, anchor?.chord)}
            className="flex flex-col items-start rounded-lg px-0.5 active:opacity-60"
            style={{ minHeight: 44 }}
            aria-label={label ? `${text}, chord ${label} — tap to change` : `${text} — tap to add a chord`}
          >
            {label ? (
              <span
                className="leading-none mb-1"
                style={{
                  backgroundColor: "var(--cog-gold-pale)",
                  color: "var(--cog-charcoal)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  padding: "3px 8px",
                  borderRadius: 9999,
                }}
              >
                {label}
              </span>
            ) : (
              <span className="text-[0.8125rem] font-bold leading-none mb-1" style={{ color: "var(--cog-muted)", opacity: 0.45 }}>
                +
              </span>
            )}
            <span className="leading-snug" style={{ fontSize: "0.9375rem", color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Craft (rhyme & meter) view ──────────────────────────────────────────────

function CraftView({ sections }: { sections: SheetSection[] }) {
  // Rhyme scheme is computed across all lyric lines in order, so matching
  // endings share a letter throughout the song. Syllable count per line makes
  // meter visible (parallel lines should match).
  const allLines = sections.flatMap((s) => s.lines.map((l) => l.text));
  const scheme = rhymeScheme(allLines);
  let idx = 0;
  return (
    <div className="flex flex-col gap-7">
      {sections.map((section, si) => (
        <section key={si}>
          {section.label && (
            <div className="mb-2.5">
              <SectionLabel>{section.label}</SectionLabel>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {section.lines.map((line, li) => {
              const label = scheme[idx];
              const hasText = line.text.trim() !== "";
              const syl = hasText ? countLineSyllables(line.text) : "";
              idx++;
              return (
                <div key={li} className="flex items-baseline gap-2.5">
                  <span
                    className="text-xs font-bold tabular-nums text-center shrink-0"
                    style={{ color: "var(--cog-gold-alt, var(--cog-gold))", width: 14 }}
                  >
                    {hasText ? label : ""}
                  </span>
                  <span className="text-[0.6875rem] tabular-nums text-right shrink-0" style={{ color: "var(--cog-muted)", width: 18 }}>
                    {syl}
                  </span>
                  <span className="text-[0.9375rem]" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    {line.text || " "}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Loading / error / empty states ──────────────────────────────────────────

function SheetLoading() {
  return (
    <div className="space-y-3 pt-2" aria-label="Loading song sheet">
      <div className="h-4 w-24 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
      <div className="h-10 rounded-2xl" style={{ backgroundColor: "var(--cog-cream-light)" }} />
      <div className="h-10 rounded-2xl" style={{ backgroundColor: "var(--cog-cream-light)" }} />
      <div className="h-10 rounded-2xl" style={{ backgroundColor: "var(--cog-cream-light)" }} />
    </div>
  );
}

function SheetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-2 pt-10 pb-12">
      <p className="text-sm mb-5" style={{ color: "var(--cog-warm-gray)", maxWidth: "18rem", fontFamily: "var(--font-body)" }}>
        We couldn't reach this song's sheet just now. Your words are safe — try again in a moment.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center rounded-full text-sm font-semibold px-6 active:scale-[0.98]"
        style={{ minHeight: 44, backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
      >
        Try again
      </button>
    </div>
  );
}

function SheetEmptyState({ onAddSection, onPaste, onExample }: { onAddSection: () => void; onPaste: () => void; onExample: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-2 pt-8 pb-12">
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 72, height: 72, backgroundColor: "var(--cog-gold-pale)" }}>
        <Music size={30} strokeWidth={1.6} style={{ color: "var(--cog-gold-alt, var(--cog-gold))" }} />
      </div>
      <h2 className="mb-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", fontSize: "1.375rem" }}>
        Start this song's sheet
      </h2>
      <p className="text-sm mb-7" style={{ color: "var(--cog-warm-gray)", maxWidth: "17rem", fontFamily: "var(--font-body)" }}>
        Write a line, or paste a chart you already have.
      </p>
      <button
        type="button"
        onClick={onAddSection}
        className="inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold mb-3 transition-transform active:scale-[0.98]"
        style={{ width: "100%", maxWidth: 320, minHeight: 52, backgroundColor: "var(--cog-gold)", color: "#fff", boxShadow: "0 4px 16px rgba(184,149,58,0.35)" }}
      >
        <Plus size={16} strokeWidth={2.2} /> Add your first section
      </button>
      <button
        type="button"
        onClick={onPaste}
        className="inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium mb-3 transition-transform active:scale-[0.98]"
        style={{ width: "100%", maxWidth: 320, minHeight: 48, backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
      >
        <Wand2 size={15} strokeWidth={2} /> Paste a chart
      </button>
      <button type="button" onClick={onExample} className="text-sm font-medium active:scale-95" style={{ color: "var(--cog-warm-gray)", minHeight: 44 }}>
        See an example
      </button>
    </div>
  );
}

// ─── Bottom sheets ───────────────────────────────────────────────────────────

function BottomSheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useDialogDismiss(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" style={{ backgroundColor: "rgba(28,26,23,0.32)" }} />
      <div
        className="cog-sheet-up relative rounded-t-3xl px-5 pt-3 max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div className="mx-auto mb-3 rounded-full" style={{ width: 36, height: 5, backgroundColor: "var(--cog-border)" }} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>{label}</p>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex items-center justify-center rounded-full active:scale-90" style={{ width: 44, height: 44, color: "var(--cog-warm-gray)" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddSectionSheet({ onPick, onClose }: { onPick: (label: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState("");
  return (
    <BottomSheet label="Add a section" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {SECTION_VOCAB.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            className="rounded-xl text-sm font-medium py-3 transition-transform active:scale-95"
            style={{ backgroundColor: "#fff", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)", minHeight: 48, fontFamily: "var(--font-body)" }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) onPick(custom.trim());
          }}
          placeholder="Or name your own…"
          aria-label="Custom section name"
          className="flex-1 rounded-xl px-3 outline-none text-sm"
          style={{ minHeight: 48, backgroundColor: "#fff", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
        />
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => onPick(custom.trim())}
          className="inline-flex items-center justify-center rounded-xl text-sm font-semibold px-4 transition-transform active:scale-95 disabled:opacity-40"
          style={{ minHeight: 48, backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)" }}
        >
          Add
        </button>
      </div>
    </BottomSheet>
  );
}

function ConfirmRemoveSheet({ section, onConfirm, onClose }: { section: SheetSectionDoc; onConfirm: () => void; onClose: () => void }) {
  return (
    <BottomSheet label={`Remove ${section.label || "this section"}?`} onClose={onClose}>
      <p className="text-sm mb-5" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
        Its lines leave the sheet, but the song's history keeps them — nothing is truly lost.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full text-sm font-medium py-3 active:scale-[0.97]"
          style={{ backgroundColor: "var(--cog-cream)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-full text-sm font-semibold py-3 active:scale-[0.97]"
          style={{ backgroundColor: "var(--cog-charcoal)", color: "#fff" }}
        >
          Remove section
        </button>
      </div>
    </BottomSheet>
  );
}

function ToolsSheet(props: {
  onClose: () => void;
  displayKey: string;
  display: "letters" | "numbers";
  capo: number;
  capoHints: Array<{ capo: number; playKey: string }>;
  showSyllables: boolean;
  craft: boolean;
  copied: boolean;
  disabled: boolean;
  onStepKey: (s: number) => void;
  onDisplay: (d: "letters" | "numbers") => void;
  onCapo: (n: number) => void;
  onSyllables: () => void;
  onCraft: () => void;
  onPerform: () => void;
  onImport: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onShare: () => void;
}) {
  const p = props;
  return (
    <BottomSheet label="Sheet tools" onClose={p.onClose}>
      <div className="flex flex-col gap-4 pb-2">
        <button
          type="button"
          onClick={p.onPerform}
          disabled={p.disabled}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold py-3 transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ backgroundColor: "var(--cog-gold)", color: "#fff", boxShadow: "0 4px 16px rgba(184,149,58,0.35)" }}
        >
          <Play size={16} strokeWidth={2.2} /> Perform
        </button>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.08em" }}>Key</span>
          <div className="flex items-center gap-0.5 rounded-full px-1" style={{ backgroundColor: "var(--cog-cream)", border: "1px solid var(--cog-border)" }}>
            <button type="button" onClick={() => p.onStepKey(-1)} disabled={p.display === "numbers" || p.disabled} aria-label="Lower key" className="flex items-center justify-center rounded-xl active:scale-90 disabled:opacity-30" style={{ width: 40, height: 40, color: "var(--cog-charcoal)" }}>
              <Minus size={16} strokeWidth={2.2} />
            </button>
            <span className="text-sm font-semibold tabular-nums text-center" style={{ color: "var(--cog-charcoal)", minWidth: 30 }}>
              {p.display === "numbers" ? "1–7" : p.displayKey}
            </span>
            <button type="button" onClick={() => p.onStepKey(1)} disabled={p.display === "numbers" || p.disabled} aria-label="Raise key" className="flex items-center justify-center rounded-xl active:scale-90 disabled:opacity-30" style={{ width: 40, height: 40, color: "var(--cog-charcoal)" }}>
              <Plus size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex rounded-full p-0.5" style={{ backgroundColor: "var(--cog-cream)" }}>
            <ToolToggle active={p.display === "letters"} onClick={() => p.onDisplay("letters")} label="Letters">
              <Type size={13} strokeWidth={2} />
            </ToolToggle>
            <ToolToggle active={p.display === "numbers"} onClick={() => p.onDisplay("numbers")} label="Numbers">
              <Hash size={13} strokeWidth={2} />
            </ToolToggle>
          </div>
        </div>

        <div className="flex items-center gap-2" aria-label="Capo">
          <span className="text-xs uppercase tracking-wide shrink-0" style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.08em" }}>Capo</span>
          <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => p.onCapo(n)}
                aria-pressed={p.capo === n}
                aria-label={n === 0 ? "Capo off" : `Capo fret ${n}`}
                className="shrink-0 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-transform active:scale-90"
                style={{
                  minWidth: 38,
                  minHeight: 38,
                  backgroundColor: p.capo === n ? "var(--cog-gold)" : "rgba(28,26,23,0.05)",
                  color: p.capo === n ? "#fff" : "var(--cog-warm-gray)",
                }}
              >
                {n === 0 ? "Off" : n}
              </button>
            ))}
          </div>
        </div>

        {p.capoHints.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide shrink-0" style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.08em" }}>Easy keys</span>
            {p.capoHints.map((h) => (
              <button
                key={h.capo}
                type="button"
                onClick={() => p.onCapo(h.capo)}
                aria-label={`Capo ${h.capo}, play in ${h.playKey}`}
                className="inline-flex items-center gap-1 rounded-full text-xs font-medium transition-transform active:scale-95"
                style={{
                  minHeight: 34,
                  padding: "0 10px",
                  backgroundColor: p.capo === h.capo ? "var(--cog-gold)" : "rgba(184,149,58,0.10)",
                  color: p.capo === h.capo ? "#fff" : "var(--cog-charcoal)",
                  border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))",
                }}
              >
                Capo {h.capo} · {h.playKey}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2.5">
          <ToolButton onClick={p.onSyllables} active={p.showSyllables}>
            <Ruler size={14} strokeWidth={2} /> Syllables
          </ToolButton>
          <ToolButton onClick={p.onCraft} active={p.craft}>
            <Guitar size={14} strokeWidth={2} /> Rhyme
          </ToolButton>
        </div>
        <div className="flex gap-2.5">
          <ToolButton onClick={p.onImport}>
            <Pencil size={14} strokeWidth={2} /> Edit chart
          </ToolButton>
          <ToolButton onClick={p.onCopy}>
            {p.copied ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={2} />}
            {p.copied ? "Copied" : "ChordPro"}
          </ToolButton>
        </div>
        <div className="flex gap-2.5">
          <ToolButton onClick={p.onPrint}>
            <Printer size={14} strokeWidth={2} /> Print · PDF
          </ToolButton>
          <ToolButton onClick={p.onShare}>
            <Share2 size={14} strokeWidth={2} /> Share
          </ToolButton>
        </div>
      </div>
    </BottomSheet>
  );
}

function ToolToggle({ children, label, active, onClick }: { children: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 px-3 text-xs font-medium transition-colors"
      style={{
        height: 36,
        borderRadius: 9999,
        backgroundColor: active ? "var(--cog-gold)" : "transparent",
        color: active ? "#fff" : "var(--cog-charcoal)",
      }}
    >
      {children} {label}
    </button>
  );
}

function ToolButton({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium transition-transform active:scale-[0.97]"
      style={{
        backgroundColor: active ? "var(--cog-gold-pale)" : "var(--cog-cream)",
        border: "1px solid var(--cog-border)",
        color: "var(--cog-charcoal)",
        minHeight: 44,
      }}
    >
      {children}
    </button>
  );
}

// ─── ChordPro import / power-user panel (a view over the doc, never the truth) ─

function ImportSheet({
  initialSource,
  initialKey,
  onDone,
  onClose,
}: {
  initialSource: string;
  initialKey: string;
  onDone: (source: string, key: string) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  const [key, setKey] = useState(initialKey);
  const canConvert = looksLikeChordsOverLyrics(source);

  return (
    <BottomSheet label="Edit chart · ChordPro" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {canConvert && (
          <button
            type="button"
            onClick={() => setSource(chordsOverLyricsToChordPro(source, key))}
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]"
            style={{ backgroundColor: "rgba(184,149,58,0.10)", border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))" }}
          >
            <Wand2 size={18} strokeWidth={2} style={{ color: "var(--cog-gold-alt, var(--cog-gold))", flexShrink: 0 }} />
            <span className="flex-1 text-sm" style={{ color: "var(--cog-charcoal)" }}>
              Looks like a chords-over-lyrics chart.{" "}
              <span style={{ fontWeight: 600, color: "var(--cog-gold-alt, var(--cog-gold))" }}>Convert to chords</span>
            </span>
          </button>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)" }}>This chart is in</span>
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }}>
            {MAJOR_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKey(k)}
                className="px-2.5 py-1 rounded-lg text-sm font-medium shrink-0 transition-transform active:scale-95"
                style={{
                  backgroundColor: k === key ? "var(--cog-gold)" : "white",
                  color: k === key ? "#fff" : "var(--cog-charcoal)",
                  border: k === key ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
                  minHeight: 34,
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={12}
          aria-label="ChordPro chart"
          placeholder={"Paste a ChordPro chart, e.g.\n{start_of_verse: Verse 1}\n[G]Amazing [G7]grace how [C]sweet the [G]sound"}
          className="w-full rounded-2xl px-4 py-4 outline-none resize-y"
          style={{
            backgroundColor: "#fff",
            border: "1.5px solid var(--cog-border)",
            color: "var(--cog-charcoal)",
            fontFamily: MONO,
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}
        />

        <p className="text-xs" style={{ color: "var(--cog-muted)" }}>
          Chords go in [brackets] right before the syllable they land on. Sections use{" "}
          <span style={{ fontFamily: MONO }}>{"{start_of_chorus: Chorus}"}</span>. This replaces the sheet's current chart.
        </p>

        <button
          type="button"
          onClick={() => onDone(source, key)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
          style={{ backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)" }}
        >
          <Check size={15} strokeWidth={2.2} /> Done
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

function PrintSheet({
  songTitle,
  sections,
  playKey,
  display,
  capo,
}: {
  songTitle: string;
  sections: SheetSection[];
  playKey: string;
  display: "letters" | "numbers";
  capo: number;
}) {
  return (
    <div className="cog-print" aria-hidden="true">
      <h1>{songTitle}</h1>
      <p className="cog-print-sub">
        {display === "numbers" ? "Nashville numbers" : `Key of ${playKey}`}
        {capo > 0 && display !== "numbers" ? ` · Capo ${capo}` : ""}
      </p>
      {sections.map((section, si) => (
        <section key={si}>
          {section.label && <h2>{section.label}</h2>}
          {section.lines.map((line, li) => {
            const { chords, lyrics } = renderChordsOverLyrics(line, playKey, "major", display);
            return (
              <pre key={li}>
                {chords || " "}
                {"\n"}
                {lyrics || " "}
              </pre>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default SongSheetPage;
