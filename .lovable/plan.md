# Plan: Capture-First UX Patterns (7 Features)

Seven patterns, each gets its own spec. Split across three deliverable tracks so Claude (UI), Lovable (backend/SDK), and Codex (perf) can work in parallel.

## Deliverables Overview

```text
docs/claude-handoffs/
  2026-06-08-capture-bar.md              (Pattern 1 + 2)
  2026-06-08-takes-drawer.md             (Pattern 3 + 6)
  2026-06-08-mini-player.md              (Pattern 5)
  2026-06-08-share-sheet-intake.md       (Pattern 4)
  2026-06-08-contextual-menu.md          (Pattern 7)

src/integrations/cog/
  capture.ts          (quickCapture orchestrator)
  takes.ts            (list/use/archive/rename takes)
  player.ts           (global player state contract — types only)
  intake.ts           (share-sheet inbox API)

supabase/migrations/<ts>_takes_and_intake.sql
supabase/functions/
  intake-voice-memo/   (accept multipart from iOS Share Sheet → voice_memos)
  rename-take/         (validates membership, updates take metadata)
```

---

## Pattern 1 — Floating Persistent Capture Bar

**Where it lives:** Bottom of every authenticated route except `/auth`, `/onboarding`, `/invite/:token`, and full-screen recorder/canvas modes. Sits 16px above safe-area-inset-bottom; above mini-player when both visible (capture bar = bottom layer, mini-player floats above it on a single combined "dock").

**Anatomy (collapsed, 56px tall):**
- Left: gold mic icon (hold-to-record, same affordance as workspace)
- Center: input stub `"Start with a title, feeling, or scripture…"` (tappable, opens capture sheet)
- Right: `+` icon (opens capture sheet pre-expanded to "Add more")

**States:**
1. Hidden — auth/onboarding/invite routes, recording overlay active, capture sheet open
2. Resting — default; cream-light bg, 1px gold-pale top border, soft shadow upward
3. Hold-recording — mic pressed >200ms: bar morphs into waveform recorder inline (no modal), timer right-aligned, release = save take to "Unfiled inbox" if no song context, or to current song
4. Disabled (offline) — bar shows "Offline — captures will sync" in muted gray; tap still allowed, stores locally

**Context routing:**
- Inside `/song/:id/*` → capture lands in that song
- Outside (catalog, settings) → lands in **Unfiled Inbox** (new pseudo-song view at `/inbox`), user can later "Move to song…"

**Component:** `src/components/cog/CaptureBar.tsx` (Claude). State via lightweight Zustand store `useCaptureStore` (sheet open/closed, current context).

**A11y:** Mic = `button aria-label="Hold to record voice memo"`, input stub = `button aria-haspopup="dialog"`. Keyboard: `C` opens sheet, `Space` (when bar focused) starts recording.

---

## Pattern 2 — Progressive Disclosure Capture Sheet

**Trigger:** Tap capture bar input or `+`. Opens bottom sheet (90vh max, drag-to-dismiss).

**Stage 1 — Single field (default):**
- Large serif input: title/feeling/scripture
- Below: small "Add more" link in gold
- Primary CTA: "Save idea" (gold, full-width)
- Secondary: tiny mic to swap to voice-only

**Stage 2 — Expanded (after "Add more"):**
- Title field stays at top
- Newly revealed (staggered 40ms fade-up):
  - Lyric snippet (multiline)
  - Voice memo attach (hold to record OR pick from device)
  - Section dropdown (Verse 1, Chorus, etc. — only if song context)
  - Scripture reference field (auto-validates `Book Ch:Vv`)
  - Tags (chip input, freeform)
- CTA changes to "Save to [Song Name]" or "Save to Inbox"

**Save behavior:** Single transaction via `quickCapture()` SDK:
- Always creates an `idea_capture` row (new table)
- If voice memo attached → also creates `voice_memos` row, links via `capture_id`
- If section selected + lyric snippet → creates draft `lyric_lines` (not published until owner approves if contributor)

**Component:** `src/components/cog/CaptureSheet.tsx`. Uses shadcn `Sheet`. Framer Motion staggered children.

---

## Pattern 3 — Takes Drawer (Non-Destructive Auditioning)

**Concept:** Every voice memo can have multiple **takes** (re-records of the same idea). No delete — only archive. Drawer slides up from a memo card.

**Schema additions:**
```sql
-- new table
public.takes (
  id uuid pk,
  voice_memo_id uuid references voice_memos(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,  -- denormalized for RLS
  created_by uuid not null,
  storage_path text not null,           -- voice-memos bucket
  duration_seconds numeric,
  waveform_peaks jsonb,                 -- precomputed peaks array
  friendly_name text,                   -- "Sunday afternoon", auto-generated
  is_primary boolean default false,     -- "Use this take" winner
  is_archived boolean default false,
  created_at timestamptz default now()
);
-- one primary per memo
create unique index takes_one_primary on public.takes(voice_memo_id) where is_primary;
```
RLS gated by `is_song_member(song_id, auth.uid())`. GRANTs to authenticated + service_role. Migration also backfills existing `voice_memos` rows: each becomes a takes row with `is_primary=true`.

**Drawer UI (Claude):**
- Tap memo card → swipe-up drawer (60vh), takes listed newest-first
- Each take row: waveform thumbnail, friendly name, duration, tiny "Primary" gold dot if primary
- Inline play (no navigation away)
- Row actions: ["Use this take" if not primary] [Rename] [Archive (swipe left)]
- Archived takes hidden behind "Show archived (3)" disclosure
- Bottom CTA: "Record new take" (hold-to-record, layered over playing primary if user holds while primary plays = "Record over this")

**SDK (`src/integrations/cog/takes.ts`):**
- `listTakes(voice_memo_id, { include_archived })`
- `usePrimary(take_id)` → RPC that atomically flips `is_primary`
- `archiveTake(take_id)` / `unarchiveTake(take_id)`
- `renameTake(take_id, friendly_name)`
- `createTake({ voice_memo_id, blob, duration, peaks })` → uploads to storage + inserts row

**Backend RPC `set_primary_take(_take_id)`:** SECURITY DEFINER, validates membership + write role, clears other primaries, sets new one, writes activity row.

---

## Pattern 4 — iOS Share Sheet Intake

**Goal:** User shares an audio file from Apple Voice Memos / Notes / Files → lands in COG.

**Two-track approach:**

**Track A — Web Share Target (works as PWA today):**
- Add `share_target` to `public/manifest.webmanifest`:
  ```json
  "share_target": {
    "action": "/share-receive",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "title": "title", "text": "text", "files": [{ "name": "audio", "accept": ["audio/*"] }] }
  }
  ```
- Route `/share-receive` (Claude): mini-page that shows "Where should this go?" → picks song or Inbox → POSTs to edge function `intake-voice-memo`

**Track B — Native iOS Share Extension (Capacitor path):**
- Documented but deferred. Requires Capacitor + custom Swift extension. Out of scope for Lovable; Claude documents the bridge interface so a future native build can plug in.

**Edge function `intake-voice-memo`:**
- Auth via JWT
- Validates: audio mime, <50 MB, song membership (or null for Inbox)
- Uploads to `voice-memos/<song_id|inbox>/<user_id>/<uuid>.<ext>`
- Creates `voice_memos` + initial primary `takes` row
- Returns `{ voice_memo_id, song_id }` for redirect

**SDK (`src/integrations/cog/intake.ts`):** `submitSharedAudio(file, { song_id|null, title? })`, `listInboxItems()`, `moveInboxItemToSong(voice_memo_id, song_id)`.

---

## Pattern 5 — Persistent Mini-Player

**Where it lives:** Bottom dock, above CaptureBar. Hidden when nothing is playing. Survives route changes.

**Anatomy (64px tall):**
- Left: 40px gold-tinted thumbnail (waveform sparkline)
- Middle: take friendly name (1 line, truncate) + song title (warm-gray, smaller)
- Right: play/pause, next-take chevron (cycles takes of same memo), close (X stops + dismisses)
- Tap middle area → navigates to source `/song/:id/voice?memo=…&take=…`

**Expanded state:** Swipe up → full-screen player overlay with full waveform scrubber, take selector, lyrics shown below if memo is section-linked.

**Architecture:**
- Global `<MiniPlayerHost />` mounted once in root layout (Claude)
- Zustand `usePlayerStore`: `{ currentTake, queue, isPlaying, position, expanded }`
- Single shared `<audio>` element ref to avoid double-decoding
- SDK contract `src/integrations/cog/player.ts` exports **types only** — `PlayerTake`, `PlayerSource` — no logic (player is pure frontend)

**Lock-screen / Media Session API:** Wire up `navigator.mediaSession.metadata` with song title + take name so iOS lock-screen controls work for the PWA.

---

## Pattern 6 — Named Takes with Friendly Timestamps

**The journal feel:** No "Take 1, Take 2." Instead: `"Sunday afternoon · 2 min 14 sec"`, `"Late Tuesday night · 47 sec"`, `"Right after church · 1 min 8 sec"`.

**Auto-naming algorithm (server-side, in `set_default_take_name` trigger):**
- Time-of-day bucket from `created_at` in user's timezone (stored on `profiles.timezone`):
  - 5–11 → "morning", 11–14 → "midday", 14–17 → "afternoon", 17–21 → "evening", 21–5 → "late night"
- Day-of-week prefix only if Sat/Sun: "Sunday afternoon"
- Otherwise: "Tuesday evening" if >24h ago, else "This afternoon"
- Special contexts (future, optional): if user has calendar integration tag → "Right after church"
- Format: `<phrase> · <duration humanized>`

**User can rename** any time (`renameTake` SDK). Rename clears auto-update — stored `name_is_custom boolean` so we don't re-rename later.

**UI rules (Claude):**
- Always show friendly name, never UUIDs or "Take #3"
- Sort: primary always pinned top, then newest-first
- In activity feed: "Parker recorded *Sunday afternoon · 1 min 22 sec*" — italic name

---

## Pattern 7 — Contextual `…` Menu

**Rule:** Card surfaces show only 1 primary action + content. All secondary actions hide behind `…` (DotsHorizontal icon, top-right of card, 32×32 hit area).

**Menu pattern:** shadcn `DropdownMenu`, anchored top-right, fade+scale-in (150ms). Items grouped, dividers between groups, destructive last in red.

**Standard menu vocabulary (Claude — define once, reuse everywhere):**

| Card type | Primary on card | … menu items |
|---|---|---|
| Song card (catalog) | Tap → open workspace | Rename · Duplicate · Invite collaborator · Notification prefs · Archive |
| Take row | Tap → play inline | Use this take · Rename · Move to section · Download · Archive |
| Voice memo card | Tap → open takes drawer | Rename · Link to section · Re-record · Archive |
| Lyric line | Tap → edit | Add chord · Add note · Suggest change · Link voice memo · Remove |
| Collaborator row | Tap → profile | Change role · Resend invite · Remove from song |
| Activity row | Tap → jump to source | Mark as read · Mute this kind |
| Note card | Tap → edit | Pin to top · Convert to lyric · Convert to scripture · Archive |

**Component:** `src/components/cog/CardMenu.tsx` accepts `items: MenuItem[]` so every card uses identical visual + motion. Claude builds once, applies everywhere.

**A11y:** Trigger has `aria-label="More actions for <name>"`, menu items keyboard-navigable, Esc closes, focus returns to trigger.

---

## Backend / Migration Summary (Lovable owns)

1. **Migration `takes_and_intake.sql`:**
   - `idea_captures` table (Pattern 2 transactional anchor)
   - `takes` table + unique-primary index + RLS + GRANTs
   - Backfill existing `voice_memos` → one primary take each
   - Add `name_is_custom`, `friendly_name` to `takes`
   - Add `timezone text` to `profiles`
   - Trigger `set_default_take_name` (BEFORE INSERT)
   - RPC `set_primary_take(_take_id)` SECURITY DEFINER
   - RPC `list_takes(_voice_memo_id, _include_archived)` SECURITY DEFINER
   - RPC `quick_capture(...)` SECURITY DEFINER — atomic Stage-2 save
   - Activity log entries for: take_primary_changed, take_archived, capture_saved

2. **Edge functions:**
   - `intake-voice-memo` (Pattern 4)
   - `rename-take` (optional — straight update works via RLS, edge fn only if we need rate-limiting)

3. **Storage:**
   - Reuse private `voice-memos` bucket
   - New path convention `<song_id|inbox>/<user_id>/takes/<take_id>.<ext>`
   - Inbox path scoped by `user_id` only (no song_id) → separate RLS policy on storage.objects

4. **SDK files** (`src/integrations/cog/`): `capture.ts`, `takes.ts`, `intake.ts`, `player.ts` (types-only).

---

## Build Sequence (5 handoffs, parallelizable)

1. **Lovable now:** Migration + RPCs + edge function + SDK files. ~1 turn.
2. **Claude parallel track A:** CaptureBar + CaptureSheet (Patterns 1+2) against the SDK.
3. **Claude parallel track B:** Takes drawer + friendly names UI (Patterns 3+6).
4. **Claude parallel track C:** MiniPlayer + CardMenu component (Patterns 5+7).
5. **Claude track D (after PWA bits land):** `/share-receive` route + manifest update (Pattern 4 Track A).
6. **Codex:** Stress takes table at 100 takes/memo; player memory leak audit on long sessions; share-target round-trip on real iOS.

## Hard Anti-Patterns (do not build)

- No "Delete" anywhere on takes — archive only, with "Restore" affordance.
- No badge counts on capture bar or mini-player.
- No autoplay of next memo after one finishes (calm UX).
- No public takes/captures — every RLS policy goes through `is_song_member`.
- No raw audio content sent to any third-party AI; only metadata.

## Out of Scope (this plan)

- Waveform trim handles (separate spec)
- Comment pin-drops on waveforms (separate spec)
- Native iOS Share Extension Swift code (documented bridge only)
- Calendar integration for "Right after church" naming (future)
