## Goal
Make Scripture capture frictionless: the songwriter types a reference like `Psalm 23` or `John 3:16-17`, the app auto-fetches the passage from a Bible API, and they can either keep the whole chapter (default) or tap to pick specific verses — then save into the take like any other pending block.

## UX (inside the existing Capture Sheet, `action === "scripture"`)

Replace the plain textarea with a 3-zone picker:

```
┌──────────────────────────────────────────────┐
│  Add scripture                    [ WEB ▾ ]  │  ← translation pill
│  Type a reference. Whole chapter by default. │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Psalm 23                          ✕   │  │  ← reference input (autofocus)
│  └────────────────────────────────────────┘  │
│  Psalm 23 · 6 verses · all selected          │  ← status line
│                                              │
│  [ All ]  [ First verse ]  [ Clear ]         │  ← quick chips
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ☑ 1  The Lord is my shepherd; I shall  │  │  ← scrollable verse list
│  │      not want.                          │  │     each row toggles
│  │ ☑ 2  He makes me lie down in green …    │  │     gold check when selected
│  │ ☑ 3  He restores my soul. He leads me … │  │
│  │ …                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [ Save to take ]                            │
│  [ Cancel ]   [ paste manually instead ]     │
└──────────────────────────────────────────────┘
```

Behavior:
1. **Autofocus** the reference input when the sheet opens.
2. As they type, debounce 300ms then call `parseReference()` (client-side, no network). If the parse succeeds, call `fetchPassage()` via the edge function. While loading, show a one-line shimmer where the verse list will appear.
3. On success, render every verse with a gold checkbox; **all verses pre-selected** when the user typed just `Psalm 23` (no verse range), only the typed range pre-selected when they typed `John 3:16-17`.
4. Tapping a verse row toggles selection. Quick chips:
   - `All` → select every verse
   - `First verse` → select only verse 1
   - `Clear` → deselect all (Save disabled until something is selected)
5. The translation pill opens a small popover with three options (WEB default, KJV, ASV — all public domain via `bible-api.com`). Persist last choice in `localStorage` under `cog.scripture.translation`.
6. `Save to take`:
   - `label` = canonical ref (e.g. `Psalm 23 (WEB)` if all selected, `Psalm 23:1-3 (WEB)` if contiguous range, `Psalm 23:1,3,5 (WEB)` if sparse).
   - `text` = selected verses joined with `\n`, each line prefixed with the verse number (`1 The Lord is my shepherd…`).
   - Existing `PendingBlock` shape, `kind: "scripture"` — no schema change.
7. Errors:
   - Parse fails → show inline hint `Try "Psalm 23" or "John 3:16-17"`. No fetch.
   - Fetch fails / not found → toast `Couldn't find that passage` + reveal the original plain textarea so they can paste manually. The textarea is otherwise hidden behind a `paste manually instead` link.

## Reference parser (client, no network)

`src/lib/scripture/parseReference.ts` exports:

```ts
type ParsedRef = {
  book: string;          // canonical name e.g. "Psalms", "1 Corinthians"
  bookId: string;        // bible-api slug e.g. "psalms", "1corinthians"
  chapter: number;
  verses?: { start: number; end: number }; // omitted = whole chapter
  display: string;       // pretty version for the UI
};

function parseReference(input: string): ParsedRef | null;
```

- Built-in book table (66 books) with aliases: `ps`, `psa`, `psalm`, `psalms` → Psalms; `1 cor`, `1cor`, `i corinthians` → 1 Corinthians; `song`, `sos` → Song of Solomon; etc.
- Regex: `^\s*(\d?\s*[a-z. ]+?)\s+(\d+)(?::(\d+)(?:[-–](\d+))?)?\s*$/i` then alias lookup.
- Pure function, fully unit-testable. No deps.

## Bible source

`bible-api.com` — free, no auth, CORS-enabled, three public-domain translations (WEB, KJV, ASV). Endpoint format:

```
GET https://bible-api.com/psalm+23?translation=web
GET https://bible-api.com/john+3:16-17?translation=kjv
```

Response shape we'll normalize:
```json
{
  "reference": "Psalm 23",
  "verses": [{ "book_name":"Psalms", "chapter":23, "verse":1, "text":"The Lord is my shepherd…" }, …],
  "translation_id": "web"
}
```

We proxy through an edge function so:
- We control CORS / future provider swap (api.bible for ESV/NIV later).
- We can cache hot chapters in memory and via response headers.
- The provider's URL never appears in the client bundle.

## Edge function: `fetch-scripture`

`supabase/functions/fetch-scripture/index.ts`

- Method: `POST`, JSON body validated with Zod:
  ```ts
  { reference: string (1..120 chars), translation: "web"|"kjv"|"asv" (default "web") }
  ```
- `verify_jwt = true` (default — only logged-in users hit it; cheap protection from open abuse). No song membership needed.
- Logic:
  1. Build provider URL: `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`.
  2. In-memory `Map<string, { at: number; payload: any }>` cache keyed by `${translation}|${normalizedRef}`, TTL 24h, max 200 entries (LRU-ish via `Map` insertion order).
  3. Fetch with 6s timeout.
  4. Normalize to:
     ```ts
     {
       canonical: "Psalm 23",
       book: "Psalms",
       chapter: 23,
       translation: "web",
       verses: [{ verse: 1, text: "…" }, …]
     }
     ```
  5. Return `200` with `Cache-Control: public, max-age=86400, immutable` so the browser caches identical calls.
  6. Errors:
     - Parse-side issues → `400 { error: "invalid_reference" }`.
     - Upstream 404 → `404 { error: "not_found" }`.
     - Upstream 5xx / timeout → `502 { error: "upstream_unavailable" }`.
- CORS via `npm:@supabase/supabase-js@2/cors`.
- No new secrets, no DB writes, no storage. Pure read pass-through.

## Client SDK

`src/integrations/cog/scripture.ts`:

```ts
export type ScripturePassage = {
  canonical: string;
  book: string;
  chapter: number;
  translation: "web" | "kjv" | "asv";
  verses: { verse: number; text: string }[];
};

export async function fetchPassage(
  reference: string,
  translation: "web" | "kjv" | "asv" = "web",
): Promise<ScripturePassage>;
```

Thin wrapper over `supabase.functions.invoke("fetch-scripture", ...)`. Also maintains an in-memory `Map` cache (per session) keyed identically to the edge function, so re-opens during the same session don't even hit the network.

## New component

`src/components/capture/ScripturePicker.tsx`

Props: `{ onPicked: (label: string, text: string) => void; onFallbackPaste: () => void; }`.
Internal state: `query`, `parsed`, `passage`, `selected: Set<number>`, `loading`, `translation`, `error`.

This is rendered by `CaptureSheet` only when `action === "scripture"`. The existing textarea remains as the fallback path, hidden behind `paste manually instead` (or shown automatically if the fetch fails).

## Files

- New: `src/lib/scripture/parseReference.ts` (+ `bookTable.ts` with the 66-book alias map)
- New: `src/integrations/cog/scripture.ts`
- New: `src/components/capture/ScripturePicker.tsx`
- New: `supabase/functions/fetch-scripture/index.ts`
- Edit: `src/components/capture/CaptureSheet.tsx` — when `action === "scripture"`, render `<ScripturePicker />` above (and the textarea fallback below, hidden by default). Wire its `onPicked(label, text)` to call the existing `onSave(...)` with `kind: "scripture"`.

## Verification

1. Open Capture → tap **Scripture** chip → sheet opens with autofocused input.
2. Type `Psalm 23` → after 300ms, 6 verses appear, all pre-checked. Save → pending block stored with label `Psalm 23 (WEB)`, text containing all 6 numbered verses.
3. Type `John 3:16-17` → only verses 16-17 appear pre-checked. Tap verse 17 to deselect → label becomes `John 3:16 (WEB)`.
4. Type `Psalm 119` → all 176 verses render in a scrollable list, sheet doesn't overflow viewport.
5. Type `Habakuk 99` → inline `Couldn't find that passage` + textarea fallback appears.
6. Switch translation to KJV → list refetches, persists across sheet reopens.
7. Offline / edge fn fails → toast + textarea fallback works, save still functions.
8. After save, the pending block flows into Review Sheet exactly like Lyrics/Idea blocks today.

## Explicit non-goals (deferred)
- ESV/NIV/NLT translations (require paid API + licensing).
- Cross-chapter references (`John 3:16-4:2`) — parser returns `null` for now.
- Verse search by keyword (`"shepherd"`).
- Inline Scripture lookup inside the lyrics editor (this pass is only the Capture rail).
- Saving the chosen passage to a per-song `scripture_zone` table — Product Vision doc 10 (Story/Scripture/Meaning Zone). That backend table is a later phase; today this just becomes a pending block of `kind: "scripture"`.
