/**
 * Pure block-correction operations for the Review sheet (Descript-grade
 * fixing: split a block, move one line between sections, confirm a flagged
 * low-confidence marker). Pure data in, pure data out — unit-testable, no
 * React. All operations are NON-DESTRUCTIVE to the take: they only reshape
 * the editable block copies; raw words and audio are never touched.
 */

export interface EditableBlockLike {
  id: string;
  kind: string;
  section_kind: string | null;
  label: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

/** Snap a character offset to the nearest whitespace boundary in `text`. */
function snapToWordBoundary(text: string, at: number): number {
  if (at <= 0 || at >= text.length) return Math.max(0, Math.min(at, text.length));
  if (/\s/.test(text[at]) || /\s/.test(text[at - 1])) return at;
  const before = text.lastIndexOf(" ", at);
  const after = text.indexOf(" ", at);
  if (before < 0) return after < 0 ? at : after;
  if (after < 0) return before;
  return at - before <= after - at ? before : after;
}

/** Proportional time split for a char offset inside a block. */
function timeAtChar(block: EditableBlockLike, at: number): number {
  const span = Math.max(0, block.end_ms - block.start_ms);
  if (span === 0 || block.text.length === 0) return block.start_ms;
  const frac = Math.max(0, Math.min(1, at / block.text.length));
  return Math.round(block.start_ms + span * frac);
}

/**
 * Split one block into two at a character offset (snapped to a word
 * boundary). The second half keeps the first's kind/section so a relabel is
 * one further tap, never required.
 */
export function splitBlockAtChar<T extends EditableBlockLike>(
  blocks: T[],
  id: string,
  caret: number,
  makeId: () => string,
): T[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx < 0) return blocks;
  const block = blocks[idx];
  const at = snapToWordBoundary(block.text, caret);
  const head = block.text.slice(0, at).trimEnd();
  const tail = block.text.slice(at).trimStart();
  if (head.length === 0 || tail.length === 0) return blocks;

  const splitMs = timeAtChar(block, at);
  const first: T = { ...block, text: head, end_ms: splitMs };
  const second: T = {
    ...block,
    id: makeId(),
    text: tail,
    start_ms: splitMs,
    end_ms: block.end_ms,
  };
  const copy = blocks.slice();
  copy.splice(idx, 1, first, second);
  return copy;
}

export interface CandidateSplit {
  atMs: number;
  label: string;
  /** SectionKind slug ("chorus"). */
  kind: string;
}

/**
 * Apply a confirmed low-confidence marker: split the block containing `atMs`
 * at the time-proportional word boundary and label the second half with the
 * candidate's section. If no block contains the moment (server timings can
 * differ from live ones), fall back to the block whose range is nearest — the
 * user confirmed a SUGGESTION and can nudge the result, so approximate is
 * honest here, silent inaction is not.
 */
export function confirmCandidateSplit<T extends EditableBlockLike>(
  blocks: T[],
  candidate: CandidateSplit,
  makeId: () => string,
): T[] {
  if (blocks.length === 0) return blocks;
  let idx = blocks.findIndex(
    (b) => b.end_ms > b.start_ms && candidate.atMs >= b.start_ms && candidate.atMs < b.end_ms,
  );
  if (idx < 0) {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    blocks.forEach((b, bIdx) => {
      const mid = (b.start_ms + b.end_ms) / 2;
      const dist = Math.abs(mid - candidate.atMs);
      if (dist < bestDist) {
        bestDist = dist;
        best = bIdx;
      }
    });
    idx = best;
  }

  const block = blocks[idx];
  const span = Math.max(1, block.end_ms - block.start_ms);
  const frac = Math.max(0, Math.min(1, (candidate.atMs - block.start_ms) / span));
  const at = snapToWordBoundary(block.text, Math.round(block.text.length * frac));
  const head = block.text.slice(0, at).trimEnd();
  const tail = block.text.slice(at).trimStart();

  const copy = blocks.slice();
  if (head.length === 0 || tail.length === 0) {
    // Nothing to split — the moment lands at the block's edge. Relabel the
    // block itself (empty-head) or append an empty labeled section (empty-tail)
    // so the confirmation still visibly lands.
    if (head.length === 0) {
      copy[idx] = {
        ...block,
        kind: "lyrics",
        section_kind: candidate.kind,
        label: candidate.label,
      };
      return copy;
    }
    copy.splice(idx + 1, 0, {
      ...block,
      id: makeId(),
      kind: "lyrics",
      section_kind: candidate.kind,
      label: candidate.label,
      text: "",
      start_ms: candidate.atMs,
      end_ms: block.end_ms,
    });
    return copy;
  }

  const first: T = { ...block, text: head, end_ms: candidate.atMs };
  const second: T = {
    ...block,
    id: makeId(),
    kind: "lyrics",
    section_kind: candidate.kind,
    label: candidate.label,
    text: tail,
    start_ms: candidate.atMs,
    end_ms: block.end_ms,
  };
  copy.splice(idx, 1, first, second);
  return copy;
}

/**
 * Move the line under the caret into the previous (-1) or next (+1) block —
 * the one-gesture "this line belongs to the chorus" fix. Appends to the
 * previous block's end / prepends to the next block's start.
 */
export function moveCaretLine<T extends EditableBlockLike>(
  blocks: T[],
  id: string,
  caret: number,
  dir: -1 | 1,
): T[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx < 0) return blocks;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= blocks.length) return blocks;

  const block = blocks[idx];
  const lines = block.text.split("\n");
  if (lines.length === 0) return blocks;

  // Locate the line containing the caret.
  let offset = 0;
  let lineIdx = lines.length - 1;
  for (let li = 0; li < lines.length; li += 1) {
    const end = offset + lines[li].length;
    if (caret <= end) {
      lineIdx = li;
      break;
    }
    offset = end + 1; // + newline
  }
  const line = lines[lineIdx].trim();
  if (line.length === 0) return blocks;

  const remaining = lines.filter((_, li) => li !== lineIdx).join("\n");
  const target = blocks[targetIdx];
  const targetText =
    dir === -1
      ? [target.text, line].filter(Boolean).join("\n")
      : [line, target.text].filter(Boolean).join("\n");

  const copy = blocks.slice();
  copy[idx] = { ...block, text: remaining };
  copy[targetIdx] = { ...target, text: targetText };
  return copy;
}
