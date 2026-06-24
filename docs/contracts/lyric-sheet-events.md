# Contract: Lyric & Chord Sheet → Collaboration & Song Memory

**Status:** Draft v1 · authored 2026-06-21 by the Collaboration & Song Memory lane (the aggregator).
**Owners of this seam:** Lyric & Chord Sheet lane (emits) ↔ Collaboration & Song Memory lane (aggregates).
**Why this exists:** Both lanes must build against a fixed interface so the Sheet can render suggestion/edit UI while Collaboration owns the feed, version history, and credits — with neither overwriting the other.

> **The one rule:** the Sheet **emits** structured domain events and **reads** pending suggestions. It never writes the activity feed, version snapshots, or the credits ledger itself. Collaboration is the only writer of those three.

---

## 1. Two channels (do not confuse them)

| Channel | Carries | May contain lyric/chord content? | Consumer |
|---|---|---|---|
| **Domain events** (this contract) | Product facts: a section was added, a line was suggested, the key changed | **Yes** — version history is *meant* to store song content | Collaboration → feed · version history · credits |
| **Analytics signals** (separate) | IDs, buckets, booleans, role-types only | **Never** — no raw lyrics, chords, transcripts, notes, tokens, emails, phones | Product analytics |

Domain events legitimately carry content because version history must reconstruct the song. Analytics must stay content-free. If you emit an analytics signal for the same action, strip the content first.

---

## 2. The event envelope (every Sheet event)

```ts
interface SheetEvent<T = unknown> {
  id: string;            // client-generated UUID — IDEMPOTENCY KEY (dedupes double-taps/retries)
  songId: string;
  lane: "sheet";         // constant — provenance
  type: SheetEventType;  // see §3
  actorId: string;       // who did it; Collaboration resolves display name + contributor color
  actorRole: "owner" | "contributor" | "reviewer" | "viewer"; // role AT TIME of action
  entity: {              // what it happened to (for feed labelling + version targeting)
    type: "section" | "line" | "chord" | "song";
    id: string;
    sectionLabel?: string; // e.g. "Verse 2" — lets Collaboration render "edited Verse 2" without a lookup
  };
  at: string;            // ISO-8601 timestamp (client clock; Collaboration may re-stamp on receipt)
  payload: T;            // event-specific, see §3
}

type SheetEventType =
  | "section_added" | "section_renamed" | "section_reordered" | "section_removed"
  | "lyric_edited"
  | "chords_changed"
  | "key_changed"
  | "line_suggested" | "suggestion_accepted" | "suggestion_rejected";
```

**Idempotency:** Collaboration dedupes on `id`. The Sheet must reuse the same `id` when retrying a failed emit — never mint a new one for the same logical action.

---

## 3. Event payloads

### `section_added`
```ts
{ sectionId: string; label: string; position: number; }
```
Feed: "{actor} added {label}". Version: snapshot. Credits: structural contribution.

### `section_renamed`
```ts
{ sectionId: string; from: string; to: string; }
```

### `section_reordered`
```ts
{ sectionId: string; from: number; to: number; }
```

### `section_removed`
```ts
{ sectionId: string; label: string; }    // soft action; Collaboration keeps it in version history (archive-not-delete)
```

### `lyric_edited`
```ts
{
  sectionId: string;
  lineId: string;
  lineIndex: number;
  before: string;        // prior line text (for diff + restore)
  after: string;         // new line text
}
```
Coalescing note: the Sheet should debounce keystrokes and emit ONE `lyric_edited` per settled line (not per character). Feed: "{actor} edited {sectionLabel}". Version: snapshot the line change.

### `chords_changed`
```ts
{
  sectionId: string;
  lineId: string;
  // syllable-bonded anchors AFTER the change (the canonical chord-on-syllable model):
  anchors: Array<{ chord: string; at: number }>;   // `at` = char index in the line's text
  before?: Array<{ chord: string; at: number }>;   // optional prior state for diff/restore
}
```
This is the bonded-chord model from the Sheet persona (Law 2). `at` is the character index the chord sits over; it travels with the syllable through lyric edits.

### `key_changed`
```ts
{
  fromKey: string; toKey: string;       // e.g. "G" → "A"
  capo?: number;
  display?: "letters" | "nashville";
  nonDestructive: true;                 // transpose never alters originalKey; always true from the Sheet
}
```
Feed: usually quiet/low-priority (a performance choice, not a song change). Collaboration decides whether to surface it. Version: optional.

---

## 4. Line-level suggestions (F19) — the critical sub-flow

This is the seam most likely to clash, so it is specified end to end. The **Sheet renders the propose/accept/reject UI inside the lyric line**; **Collaboration stores the pending suggestion and owns the review queue, credits, and feed.**

### Direction A — Sheet → Collaboration (emit)

`line_suggested` (a contributor proposes replacing ONE line):
```ts
{
  suggestionId: string;     // stable id for this suggestion (also used as SheetEvent.id)
  sectionId: string;
  lineId: string;
  lineIndex: number;
  original: string;         // the line as it stands now
  proposed: string;         // the suggested replacement
  note?: string;            // optional rationale from the suggester
  // suggester = envelope.actorId
}
```
The Sheet does **not** apply the change. The line stays as-is until the owner accepts.

`suggestion_accepted` (owner/authorized role accepts):
```ts
{
  suggestionId: string;
  sectionId: string;
  lineId: string;
  appliedText: string;      // what the line now reads (normally === proposed)
  suggesterId: string;      // so Collaboration credits the original suggester
}
```
On accept, the Sheet applies the line change locally/optimistically AND emits this event. Collaboration writes the feed entry, the version snapshot, and credits the suggester.

`suggestion_rejected`:
```ts
{ suggestionId: string; sectionId: string; lineId: string; reason?: string; }
```
The line is unchanged. Collaboration marks the pending suggestion resolved (kept in history, not surfaced as a change).

### Direction B — Collaboration → Sheet (read)

So the Sheet can render the accept/reject affordance on the right line, Collaboration exposes a read API (shape TBD by Collaboration, but the Sheet consumes this contract):
```ts
// pending suggestions for a song, keyed so the Sheet can attach them to lines
getPendingSuggestions(songId): Promise<Array<{
  suggestionId: string;
  sectionId: string;
  lineId: string;
  proposed: string;
  note?: string;
  suggesterDisplay: string;   // name only — resolved by Collaboration
  suggesterColor: string;     // contributor color — resolved by Collaboration
  createdAt: string;
}>>
```
The persistent pending-suggestion store and the owner Review Queue belong to Collaboration. The Sheet only renders inline accept/reject for the line currently in view.

---

## 5. Authority & failure rules

- **Permissions are server-validated** (Admin backend). A `viewer` can never emit edit/suggestion-accept events that stick; the Sheet gates UI, the server is the gate. `line_suggested` is allowed for `contributor`+; `suggestion_accepted/rejected` for `owner` (or a role the owner grants).
- **Optimistic + reconcile:** the Sheet may apply edits/accepts optimistically; on server rejection it rolls back and surfaces a calm message ("the arrangement changed — review the latest version"), never a hard error.
- **Conflict is lossless:** simultaneous edits never silently overwrite. If the Sheet's base version is stale, Collaboration returns a conflict and both versions survive for review.
- **Dropped emit:** the Sheet retains the event locally and retries with the same `id`; a lyric/edit is never lost because an emit failed.

---

## 6. Open items to confirm before build
1. Read-API transport for Direction B (Collaboration to specify: query hook vs. realtime subscription).
2. Whether `key_changed` surfaces in the feed at all (Collaboration's call — leaning "no, performance-only").
3. Review Queue ownership confirmed as Collaboration (Sheet renders inline only) — verify against the Canvas lane's F11 scope so the queue isn't built twice.
4. Snapshot granularity for `lyric_edited` (per-line settle vs. per-section) — Collaboration to set the debounce expectation the Sheet emits against.
