/**
 * stackModel — the pure logic of a layered voice-memo stack.
 *
 * A "stack" is one base memo plus the child layers recorded over it
 * ("Record over this"). Layers are NEVER a destructive edit of the base —
 * they are child memos linked by `parentMemoId`. This module owns the two
 * decisions that make stacking correct, and keeps them free of React/audio so
 * they can be unit-tested:
 *
 *   1. groupIntoStacks — turn a flat memo list into base+layers groups.
 *   2. resolveAudible  — given mute/solo state, which layers should sound.
 *
 * The UI (MemoStack) and the audio engine (useStackPlayer) consume these; they
 * do not re-derive them.
 */

/** Minimal shape a memo needs to participate in a stack. */
export interface StackableMemo {
  id: string;
  /** The base memo this is a layer of. null/undefined ⇒ this memo IS a base. */
  parentMemoId?: string | null;
  /** Recording order tiebreaker; older bases/layers sort first. */
  createdAt?: string;
}

export interface MemoStackGroup<T extends StackableMemo> {
  /** The base memo every layer was recorded over. */
  base: T;
  /** Child layers, oldest first. Empty when the base has no layers yet. */
  layers: T[];
}

function byCreatedAtAsc(a: StackableMemo, b: StackableMemo): number {
  const at = a.createdAt ? Date.parse(a.createdAt) : 0;
  const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
  if (at !== bt) return at - bt;
  // Stable fallback so ordering is deterministic without timestamps.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Group a flat memo list into base+layers stacks.
 *
 * Rules that protect the song:
 *  - A memo whose `parentMemoId` points at a base in this list becomes that
 *    base's layer.
 *  - An ORPHAN layer (its parent isn't present — deleted, archived, or not yet
 *    loaded) is promoted to its own base rather than silently dropped. A
 *    captured idea is never lost.
 *  - Bases preserve the input ordering of the caller's first encounter, so the
 *    canvas/list stays visually stable as layers arrive.
 */
export function groupIntoStacks<T extends StackableMemo>(memos: T[]): MemoStackGroup<T>[] {
  const byId = new Map<string, T>();
  for (const m of memos) byId.set(m.id, m);

  const layersByParent = new Map<string, T[]>();
  const baseOrder: T[] = [];

  for (const m of memos) {
    let parentId = m.parentMemoId ?? null;
    // ONE LEVEL ONLY: if the parent is itself a layer, flatten to the TOP
    // base (mirrors the DB trigger) — a layer-of-a-layer still sounds with
    // its family, never errors, never disappears.
    if (parentId && parentId !== m.id) {
      const parent = byId.get(parentId);
      const grandId = parent?.parentMemoId ?? null;
      if (grandId && grandId !== m.id && byId.has(grandId)) parentId = grandId;
    }
    if (parentId && byId.has(parentId) && parentId !== m.id) {
      const arr = layersByParent.get(parentId) ?? [];
      arr.push(m);
      layersByParent.set(parentId, arr);
    } else {
      // Base, or orphan layer promoted to base (parent missing).
      baseOrder.push(m);
    }
  }

  return baseOrder.map((base) => ({
    base,
    layers: (layersByParent.get(base.id) ?? []).slice().sort(byCreatedAtAsc),
  }));
}

/** All playable ids in a stack, base first, in play order. */
export function stackPlayOrder<T extends StackableMemo>(group: MemoStackGroup<T>): string[] {
  return [group.base.id, ...group.layers.map((l) => l.id)];
}

/**
 * Given the full set of memo ids in a stack and the current mute/solo state,
 * return the ids that should actually sound.
 *
 *  - Solo wins: when a layer is soloed, only it sounds (mutes are irrelevant).
 *  - Otherwise every id that isn't explicitly muted sounds.
 *
 * Pure and total — never throws, safe to call every render/frame.
 */
export function resolveAudible(
  allIds: string[],
  muted: ReadonlySet<string>,
  soloId: string | null,
): Set<string> {
  if (soloId && allIds.includes(soloId)) {
    return new Set([soloId]);
  }
  return new Set(allIds.filter((id) => !muted.has(id)));
}

/** Gain range for the quick mixer (matches the DB CHECK). */
export const LAYER_GAIN_MIN = 0;
export const LAYER_GAIN_MAX = 1.5;
export const LAYER_GAIN_DEFAULT = 1.0;

export function clampLayerGain(gain: number): number {
  if (!Number.isFinite(gain)) return LAYER_GAIN_DEFAULT;
  return Math.min(LAYER_GAIN_MAX, Math.max(LAYER_GAIN_MIN, gain));
}

/**
 * The effective gain per id for the whole mixing surface — volume + mute +
 * solo, nothing else (a calm sketchbook, not a DAW):
 *
 *  - Solo wins: the soloed id plays at ITS gain; everything else is 0.
 *  - A muted id is 0; everyone else plays at their persisted gain.
 *
 * Pure and total — never throws, safe to call every frame. The audio engine
 * ramps toward these targets so changes never click.
 */
export function resolveMix(
  allIds: string[],
  gains: Readonly<Record<string, number>>,
  muted: ReadonlySet<string>,
  soloId: string | null,
): Record<string, number> {
  const audible = resolveAudible(allIds, muted, soloId);
  const out: Record<string, number> = {};
  for (const id of allIds) {
    out[id] = audible.has(id) ? clampLayerGain(gains[id] ?? LAYER_GAIN_DEFAULT) : 0;
  }
  return out;
}
