# Library / Song Organization — The Next 20 Features

**Date:** 2026-07-02 · **Lane:** Song organization (catalog `/`, albums, views) — frontend only
**Benchmarks:** Apple Music Library · Apple Photos (density gestures) · Apple Notes (pinning) · Apple Mail (swipe) · Things 3 (calm organization) · Spotify Your Library
**Spec grounding:** PV11 (Your Song Catalog), PV12 (upgrade moment), PV13 (storage trust), contextual-menu handoff, CLAUDE.md locked decisions.

**Already shipped (passes 1–3):** search · sort (recent/A–Z/ideas) · comfortable/compact grid + list · pinch + trackpad density · Albums (shelf, covers, edit sheet, tap-to-focus) · press-and-hold song actions (add-to-album, archive/restore) · skeletons · status chips · A–Z scrubber · "Pick up where you left off" · persisted view prefs.

Ranked by (user value × frequency of use) ÷ effort. ⚙ = needs a small Lovable/SDK addition (UI can ship first with graceful absence). Everything else is pure frontend.

| # | Feature | What + why (benchmark) | Connects to |
|---|---|---|---|
| 1 | **Swipe-to-archive / restore on list rows** | Swipe a row left past threshold → archive (owner only), undo toast; in Archived tab the same swipe restores. Apple Mail's fastest triage gesture. | Uses existing `archiveSong`/`unarchiveSong`; calm copy per PV11. |
| 2 | **Tab count chips** | Quiet counts on Owned/Invited/Archived (PV11: "count badges optional"). Zero red, aria-labels unchanged. | Pure catalog data. |
| 3 | **Cross-lane quick routes in the song actions sheet** | Press-and-hold gains "Open canvas", "Open lyric sheet", "Voice memos" rows — the library becomes the switchboard into every lane's surface. | Canvas (`/songs/:id/canvas`), Sheet (`/songs/:id/sheet`), Capture (`/songs/:id/voice`). Routes only; never their UI. |
| 4 | **Song pinning** | Pin up to 3 songs to the top of Owned (Apple Notes). localStorage; pin via press-and-hold. | Coexists with Continue shelf (pins outrank it). |
| 5 | **Album drag-to-reorder** | Long-press-drag album cards on the shelf; order persisted locally. Direct manipulation (CapCut/Photos). | `albums.ts` gains an `order` field. |
| 6 | **Batch select mode** | Press-and-hold → "Select" → tap many songs → one action: add all to an album / archive all. Apple Photos multi-select. | Albums + archive SDK. |
| 7 | **Search across albums** | Query matches album names too; results grouped "Albums" / "Songs" (Apple Music search scopes). | `albums.ts`. |
| 8 | **Album detail header** | When an album is focused: header card with big mosaic cover, name, song/idea totals, and "Practice these" linking into the practice player. | Practice lane route only. |
| 9 | **Archived month sections** | Archived tab groups by month ("June 2026") — archived stays safe *and navigable* (PV11 archive trust). | Pure frontend. |
| 10 | **Empty-state hero** | PV11 empty Owned state: serif "Your first song lives here" + glow + gold CTA (currently plain text). | Onboarding lane owns the flow it routes into; we only render the invitation. |
| 11 | **Storage trust line** | PV13: when near cap, one quiet line under the grid — "Your songs are safe. New uploads may pause soon." → `/upgrade`. Never red, never blocking. | Reads existing pricing/plan API; Admin lane owns the rules. |
| 12 | **Recent searches** | Last 3 queries as tappable chips under the search field (Apple Music). localStorage. | Pure frontend. |
| 13 | **Per-album sort memory** | Each focused album remembers its own sort (a setlist stays in set order, the catalog stays recent-first). | `libraryPrefs` keyed by album. |
| 14 | **Tablet two-pane** | 768–1023px: albums rail left, songs right — the tablet is its own medium, not a stretched phone. | Layout only. |
| 15 | **Windowed rendering at scale** | Virtualize grid/list past ~120 songs (no new deps; simple slice-on-scroll) so a 500-song catalog stays instant. | Performance backbone for everything above. |
| 16 | **Invited tab enrichment** ⚙ | Show "invited by Sarah · Contributor" on invited cards. UI ready; needs `inviter_name` on the catalog row from Lovable. | Invite lane's data, our display. |
| 17 | **Needs-attention smart shelf** ⚙ | Auto-shelf above the grid: songs with pending suggestions/reviews ("2 songs need you"). Needs `pending_suggestions` on the catalog row (already on SongDetail). | Collaboration lane's counts, our shelf. |
| 18 | **Sort by "last opened by me"** ⚙ | Distinguishes my re-entry point from collaborator noise on busy songs. Needs `last_opened_at` per member. | Lovable field; drops into the existing sort menu. |
| 19 | **Album → memory search link** | Zero-result search offers "Search your memory instead" → `/memory` (F33) so a forgotten fragment is always findable. | Memory lane route only. |
| 20 | **Real album covers** ⚙ | When songs gain cover images (Lovable storage), mosaics upgrade automatically; until then color mosaics + an initials monogram option. | Storage lane; our `coverColor` seam already isolates it. |

**Boundary rules (unchanged):** this lane never builds canvas/sheet/capture/collab UI — it routes into them; never touches Supabase schema/RLS; albums remain references (removing one never touches a song); analytics stay content-free; all color via `--cog-*` tokens; every surface ≥44px targets, `100dvh`/safe-area, reduced-motion-safe.

**This pass ships:** #1 swipe-to-archive/restore, #2 tab counts, #3 cross-lane quick routes.
