import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildTargetView,
  lineKeyOf,
  readUsedLines,
  splitLines,
  weaveCandidates,
  writeUsedLines,
  type UsedLineMap,
  type WeaveLine,
  type WeaveTargetView,
} from "@/lib/canvas/weave";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

/**
 * useWeave — the Weave mode state machine (D2).
 *
 * Enter from a final-tree section card; every idea-tree line that fits glows
 * (rhyme/meter/theme, scored by the pure engine in lib/canvas/weave.ts); tap
 * a glowing line to PLACE it into the forming section. The hook owns meaning
 * — what placing/un-placing/swapping IS — and hands the render layer plain
 * data. It never touches card state directly: the host provides `updateBody`
 * (its one write path, local-first + server sync).
 *
 * Invariants enforced here (docs/WEAVE-CONTRACT.md §1):
 *  - Non-destructive: sources are never written; "used" is a per-song local
 *    presentation map; every action has an Undo on its toast.
 *  - Undo is OPERATIONAL, never a snapshot: it removes/reverts exactly the
 *    line it names from the body as it is NOW — undoing placement A can
 *    never wipe a later placement B or a co-writer's line that landed since.
 *  - Suggest never replace: nothing here generates text — placement copies
 *    the writer's line verbatim; swaps replace one word the writer chose.
 */

export interface WeaveGlowLine extends WeaveLine {
  used: boolean;
}

interface UseWeaveArgs {
  songId: string;
  cards: CanvasBoardCard[];
  isViewer: boolean;
  /** The host's one write path for a card's body (local + server). */
  updateBody: (cardId: string, body: string) => void;
  /** Calm status line for screen readers / the status region. */
  announce?: (msg: string) => void;
}

export interface WeaveApi {
  active: boolean;
  targetId: string | null;
  target: CanvasBoardCard | null;
  targetView: WeaveTargetView | null;
  /** cardId → scored glow lines (idea-tree candidates only). */
  glow: Map<string, WeaveGlowLine[]>;
  /** Lines placed into the CURRENT target (drives the bar's count). */
  placedCount: number;
  enter: (targetId: string) => void;
  exit: () => void;
  /** Tap a glowing line: place it. Tap a used line: un-place it. */
  toggleLine: (cardId: string, index: number) => void;
  /** Line Lab: which target line is open (null = closed). */
  labIndex: number | null;
  openLab: (index: number) => void;
  closeLab: () => void;
  /** Swap one target line for a new text (Line Lab commit). Reversible. */
  swapTargetLine: (index: number, newText: string) => void;
  /** The host's create-spine swapped a local card id for its server id. */
  renameCard: (oldId: string, newId: string) => void;
}

/** Used-map keys are scoped per TARGET: the same idea line can serve a Verse
 *  and later a Chorus — "used" in one section never gates the other. */
const usedKeyFor = (cardId: string, text: string, targetId: string) =>
  `${lineKeyOf(cardId, text)}::t:${targetId}`;

/** Remove exactly one occurrence of `text` (the last whole-line match) from a
 *  body. Returns null when nothing matched — callers must then NOT write. */
function removeLineOnce(body: string, text: string): string | null {
  const lines = body.split("\n");
  const norm = text.trim();
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === norm) {
      lines.splice(i, 1);
      return lines.join("\n");
    }
  }
  return null;
}

export function useWeave({ songId, cards, isViewer, updateBody, announce }: UseWeaveArgs): WeaveApi {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [used, setUsed] = useState<UsedLineMap>(() => readUsedLines(songId));
  const [labIndex, setLabIndex] = useState<number | null>(null);

  // Undo closures re-read the board as it is at UNDO time, never at place time.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const target = useMemo(
    () => (targetId ? cards.find((c) => c.id === targetId && c.tree === "final") ?? null : null),
    [cards, targetId],
  );
  const active = Boolean(target);

  // Target vanished mid-weave (deleted / returned to Ideas on another device):
  // clear the id so a later re-appearance can't resurrect the mode unasked.
  useEffect(() => {
    if (targetId && !target) {
      setTargetId(null);
      setLabIndex(null);
    }
  }, [targetId, target]);

  const setUsedPersist = useCallback(
    (updater: (prev: UsedLineMap) => UsedLineMap) => {
      setUsed((prev) => {
        const next = updater(prev);
        writeUsedLines(songId, next);
        return next;
      });
    },
    [songId],
  );

  const glow = useMemo(() => {
    if (!target) return new Map<string, WeaveGlowLine[]>();
    const scored = weaveCandidates(cards, target);
    const out = new Map<string, WeaveGlowLine[]>();
    for (const [cardId, lines] of scored) {
      out.set(
        cardId,
        lines.map((l) => {
          const entry = used[usedKeyFor(cardId, l.text, target.id)];
          return { ...l, used: entry != null && entry.targetId === target.id };
        }),
      );
    }
    return out;
  }, [cards, target, used]);

  const targetView = useMemo(() => (target ? buildTargetView(target.body) : null), [target]);

  // An open Line Lab whose line vanished (undo fired, co-writer edit landed)
  // must CLOSE — an orphaned index blocks the mode's Escape and would
  // spontaneously re-open the lab on an arbitrary line when the section grows.
  useEffect(() => {
    if (labIndex != null && targetView?.lines[labIndex] == null) setLabIndex(null);
  }, [labIndex, targetView]);

  const enter = useCallback(
    (id: string) => {
      if (isViewer) return;
      setTargetId(id);
      setLabIndex(null);
      // Housekeeping: sweep used entries whose source line or target card no
      // longer exists (edited text, deleted cards, corrupt values).
      setUsedPersist((prev) => {
        const ids = new Set(cardsRef.current.map((c) => c.id));
        const linesByCard = new Map(
          cardsRef.current.map((c) => [c.id, new Set(splitLines(c.body).map((l) => lineKeyOf(c.id, l)))]),
        );
        const next: UsedLineMap = {};
        for (const [key, entry] of Object.entries(prev)) {
          if (!entry || typeof entry.targetId !== "string") continue;
          const tSplit = key.lastIndexOf("::t:");
          if (tSplit < 0) continue; // pre-target-scoped legacy key — drop
          const lineKey = key.slice(0, tSplit);
          const cardId = lineKey.slice(0, lineKey.indexOf("::"));
          if (!ids.has(entry.targetId)) continue;
          if (!linesByCard.get(cardId)?.has(lineKey)) continue;
          next[key] = entry;
        }
        return next;
      });
      const t = cardsRef.current.find((c) => c.id === id);
      announce?.(`Weaving into ${t?.section || t?.title || "this section"} — lines that fit are glowing.`);
    },
    [isViewer, setUsedPersist, announce],
  );

  const exit = useCallback(() => {
    setTargetId(null);
    setLabIndex(null);
  }, []);

  /** The create-spine acked: a local card id became its server id. Keep the
   *  mode + bookkeeping attached to the same card instead of silently dying. */
  const renameCard = useCallback(
    (oldId: string, newId: string) => {
      setTargetId((prev) => (prev === oldId ? newId : prev));
      setUsedPersist((prev) => {
        let touched = false;
        const next: UsedLineMap = {};
        for (const [key, entry] of Object.entries(prev)) {
          let k = key;
          let e = entry;
          if (key.startsWith(`${oldId}::`)) {
            k = `${newId}${key.slice(oldId.length)}`;
            touched = true;
          }
          if (k.endsWith(`::t:${oldId}`)) {
            k = `${k.slice(0, -oldId.length)}${newId}`;
            touched = true;
          }
          if (entry.targetId === oldId) {
            e = { ...entry, targetId: newId };
            touched = true;
          }
          next[k] = e;
        }
        return touched ? next : prev;
      });
    },
    [setUsedPersist],
  );

  const clearUsed = useCallback(
    (key: string) => {
      setUsedPersist((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setUsedPersist],
  );

  const toggleLine = useCallback(
    (cardId: string, index: number) => {
      if (!target) return;
      const lines = glow.get(cardId);
      const line = lines?.[index];
      if (!line) return;
      const key = usedKeyFor(cardId, line.text, target.id);
      const tid = target.id;
      const sectionName = target.section || target.title || "the section";

      if (line.used) {
        // Un-place: pull the line back out of the forming section. If the
        // section no longer holds it (undone, edited away), just clear the
        // mark — never write an unchanged body (phantom activity).
        const removed = removeLineOnce(target.body, line.text);
        if (removed != null) updateBody(tid, removed);
        clearUsed(key);
        announce?.(`Removed from ${sectionName}.`);
        return;
      }

      // Place: append the writer's line, verbatim, non-destructively.
      const nextBody = target.body ? `${target.body}\n${line.text}` : line.text;
      updateBody(tid, nextBody);
      setUsedPersist((prev) => ({ ...prev, [key]: { targetId: tid, placedAt: Date.now() } }));
      announce?.(`Woven into ${sectionName}.`);
      toast(`Woven into ${sectionName}`, {
        description: line.text.length > 48 ? `${line.text.slice(0, 48)}…` : line.text,
        action: {
          label: "Undo",
          onClick: () => {
            // Operational undo: remove THIS line from the body as it is NOW.
            // A later placement or a co-writer's line can never be caught in it.
            const curr = cardsRef.current.find((c) => c.id === tid);
            if (curr) {
              const removed = removeLineOnce(curr.body, line.text);
              if (removed != null) updateBody(tid, removed);
            }
            clearUsed(key);
          },
        },
      });
    },
    [glow, target, updateBody, setUsedPersist, clearUsed, announce],
  );

  const openLab = useCallback((index: number) => setLabIndex(index), []);
  const closeLab = useCallback(() => setLabIndex(null), []);

  // Escape is the mode's guaranteed keyboard exit — unless Line Lab is open
  // (its own Escape closes just the lab; the next one leaves the mode).
  const labRef = useRef(labIndex);
  labRef.current = labIndex;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && labRef.current == null) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  const swapTargetLine = useCallback(
    (index: number, newText: string) => {
      if (!target) return;
      const lines = target.body.split("\n");
      // The view skips blank lines; map the view index to the body index.
      let seen = -1;
      let bodyIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          seen += 1;
          if (seen === index) {
            bodyIndex = i;
            break;
          }
        }
      }
      if (bodyIndex < 0) return;
      const tid = target.id;
      const oldLine = lines[bodyIndex];
      lines[bodyIndex] = newText;
      updateBody(tid, lines.join("\n"));
      setLabIndex(null);
      announce?.("Line updated.");
      toast("Line updated", {
        description: `“${oldLine.trim()}” → “${newText}”`,
        action: {
          label: "Undo",
          onClick: () => {
            // Operational undo: revert only if the swapped line still stands.
            const curr = cardsRef.current.find((c) => c.id === tid);
            if (!curr) return;
            const ls = curr.body.split("\n");
            const at = ls.findIndex((l) => l.trim() === newText.trim());
            if (at < 0) return;
            ls[at] = oldLine;
            updateBody(tid, ls.join("\n"));
          },
        },
      });
    },
    [target, updateBody, announce],
  );

  const placedCount = useMemo(
    () =>
      targetId
        ? Object.entries(used).filter(([k, e]) => e?.targetId === targetId && k.endsWith(`::t:${targetId}`)).length
        : 0,
    [used, targetId],
  );

  return {
    active,
    targetId: active ? targetId : null,
    target,
    targetView,
    glow,
    placedCount,
    enter,
    exit,
    toggleLine,
    labIndex,
    openLab,
    closeLab,
    swapTargetLine,
    renameCard,
  };
}
