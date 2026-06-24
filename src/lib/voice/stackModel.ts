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
    const parentId = m.parentMemoId ?? null;
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
