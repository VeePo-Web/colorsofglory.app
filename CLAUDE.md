# COLORS OF GLORY — PROJECT CLAUDE.md
## The Definitive Project Specification for Every Conversation

---

> **CRITICAL OVERRIDE:** This codebase previously contained a fly4me.ca marketing site. That project is GONE. Every page, component, data file, and route from fly4me has been deleted or is scheduled for deletion. Do NOT reference, restore, or build on any fly4me code. This is a fresh build of a completely different product. All fly4me code must be treated as dead code to be removed.

---

## 1. WHAT WE ARE BUILDING

**Colors of Glory** is a mobile-first songwriting collaboration app for Christian songwriters, worship leaders, and creative teams.

**The core product insight (from the visual mockups):**

Before Colors of Glory: lyrics in Notes app, voice memos scattered in the recorder app, feedback buried in iMessage. Every piece of a song lives in a different place and collaborators communicate in fragments across different apps.

After Colors of Glory: every song gets its own **private room**. Inside one room: lyrics, voice memos, chords, notes, collaborators, version history, and activity feed — all connected, all in one place.

**The tagline:** *Everything for this song stays connected here.*

**Target user:** Christian songwriters working alone or with small collaborative teams (worship leaders, co-writers, musicians, producers). Faith-based creative context — the app's UX language, tone, and color system reflect spiritual intentionality, not generic tech startup aesthetics.

---

## 2. DESIGN SYSTEM — LOCKED (DO NOT DEVIATE)

These are derived directly from the approved visual mockups. Every UI decision must match this system.

### 2.1 Color Palette

```css
:root {
  /* Backgrounds */
  --cog-cream:        #F5F0E8;   /* Primary background — warm off-white */
  --cog-cream-light:  #FAF7F2;   /* Elevated card background */
  --cog-cream-dark:   #EDE7DA;   /* Subtle section dividers */

  /* Text */
  --cog-charcoal:     #1C1A17;   /* Primary text — warm near-black */
  --cog-warm-gray:    #6B6459;   /* Secondary text, labels, metadata */
  --cog-muted:        #A09689;   /* Placeholder text, disabled states */

  /* Brand Accent — Gold */
  --cog-gold:         #B8953A;   /* Primary CTA, active states, accents */
  --cog-gold-light:   #D4AE5C;   /* Hover states on gold */
  --cog-gold-pale:    #E8D5A0;   /* Light gold tints, chord chips */
  --cog-gold-glow:    rgba(184, 149, 58, 0.15);  /* Radial glow backgrounds */

  /* Borders */
  --cog-border:       rgba(28, 26, 23, 0.10);   /* Default card borders */
  --cog-border-gold:  rgba(184, 149, 58, 0.40); /* Selected/active card borders */
}
```

### 2.2 Typography

```css
/* Headings — warm serif (Playfair Display or equivalent) */
--font-display: 'Playfair Display', 'Georgia', serif;

/* Body / UI — clean humanist sans */
--font-body: 'Inter', system-ui, sans-serif;

/* Type scale */
--t-song-title:   clamp(2rem, 5vw, 3rem);    /* Song name in workspace header */
--t-section-head: 1.5rem;                    /* "Verse 1", "Chorus" labels */
--t-body:         1rem;                      /* Body text, lyrics */
--t-label:        0.875rem;                  /* Card labels, timestamps */
--t-eyebrow:      0.75rem;                   /* Uppercase category tags */
```

### 2.3 Signature Visual Effect

Every screen has a warm radial glow originating from the bottom-center or center of the screen — a soft amber/gold gradient at ~15% opacity radiating outward against the cream background. This is the spiritual warmth signature of the app. Every screen that contains an active song should have this glow.

```css
.cog-glow {
  background: radial-gradient(
    ellipse 60% 40% at 50% 85%,
    rgba(184, 149, 58, 0.18) 0%,
    transparent 70%
  );
}
```

### 2.4 Components

- **Cards:** `border-radius: 16px`, background `var(--cog-cream-light)`, border `var(--cog-border)`. On selection: border changes to `var(--cog-border-gold)`.
- **Primary CTA button:** Filled gold `bg-[var(--cog-gold)]`, white text, `border-radius: 14px`, full-width on mobile.
- **Secondary button / ghost:** White background, `var(--cog-border)` border, charcoal text.
- **Chord chips:** Small inline rounded badge, `var(--cog-gold-pale)` background, `var(--cog-charcoal)` text, positioned above lyric lines.
- **Waveform bars:** Gold color `var(--cog-gold)`, animated on playback.
- **Section labels** (Verse 1, Chorus, Bridge): Serif font, `1.25rem`, charcoal, left-aligned.

### 2.5 Motion System

```css
--cog-ease: cubic-bezier(0.25, 0.46, 0.45, 0.94);   /* Standard UI transitions */
--cog-ease-reveal: cubic-bezier(0.22, 1, 0.36, 1);  /* Content entrance */
--dur-fast:   150ms;
--dur-base:   250ms;
--dur-slow:   400ms;
--dur-modal:  600ms;
```

- Button active: `scale(0.97)`, `150ms`
- Card entrance: `translateY(8px) → translateY(0)`, `opacity 0→1`, `400ms`
- Screen transitions: slide-from-right (navigate in), slide-to-right (navigate back)
- Hold-to-record microphone: pulse ring animation, growing from center

---

## 3. APP ARCHITECTURE — CORE OBJECTS

```
User
  └── Songs (catalog)
        └── Song
              ├── Sections (Verse 1, Pre-Chorus, Chorus, Bridge, Outro...)
              │     └── Lyrics (lines of text with chord positions)
              ├── Voice Memos (audio files, waveform, name, duration, note)
              ├── Chords (key, BPM, chord progression, chord chart)
              ├── Notes (free-form text/bullets)
              ├── Collaborators (user references + role)
              ├── Versions (snapshot history)
              ├── Activity Feed (log of all changes by all collaborators)
              └── Credits (contribution ledger by collaborator)

Roles:
  Owner       — full control, all permissions
  Contributor — can add lyrics, memos, comments, ideas
  Reviewer    — can comment and approve changes
  Viewer      — can listen and read only
```

---

## 4. ROUTE ARCHITECTURE

```
/                      → Song Catalog (grid of all songs)
/song/new              → Create new song modal/flow
/song/:id              → Song Workspace (the "private room")
/song/:id/lyrics       → Lyrics + Chords editor
/song/:id/voice        → Voice Memo list + recorder
/song/:id/notes        → Notes pad
/song/:id/people       → Collaborators + roles
/song/:id/versions     → Version history timeline
/song/:id/activity     → "What changed since you left"
/song/:id/credits      → Contribution credits ledger
/song/:id/canvas       → Song Whiteboard Canvas (advanced feature)
/invite/:token         → Collaborator invite acceptance screen
/onboarding            → Onboarding flow (multi-step)
/settings              → Account + subscription settings
/upgrade               → Upgrade/pricing screen
```

---

## 5. SUPABASE DATA MODEL (Planned Schema)

Tables required (to be built from the spec documents):
- `users` (Supabase auth + profile: name, avatar, plan_tier)
- `songs` (id, owner_id, title, created_at, updated_at, plan_gate)
- `song_sections` (id, song_id, type, position, label)
- `lyrics` (id, section_id, line_text, line_position)
- `chord_positions` (id, lyric_id, chord_name, char_position)
- `voice_memos` (id, song_id, section_id, storage_url, duration, name, note)
- `song_notes` (id, song_id, content)
- `chord_charts` (id, song_id, key, bpm, progression)
- `collaborators` (id, song_id, user_id, role, invited_by, accepted_at)
- `invite_tokens` (id, song_id, email, role, token, expires_at, used_at)
- `versions` (id, song_id, snapshot_json, created_by, label, created_at)
- `activity_log` (id, song_id, user_id, action_type, entity_type, entity_id, summary, created_at)
- `credits` (id, song_id, user_id, contribution_types[])
- `referrals` (id, referrer_id, referee_id, reward_type, created_at)

---

## 6. TECH STACK — WHAT STAYS, WHAT GOES

### KEEP (already installed, do not change)
```json
React 18 + Vite + TypeScript (strict)
Tailwind CSS v3
shadcn/ui (full component library in src/components/ui/)
Framer Motion (for all animations)
Supabase JS (auth + database + storage)
TanStack Query (data fetching)
React Hook Form + Zod (forms + validation)
React Router DOM v6
Lucide React (icons)
Sonner (toasts)
Lenis (smooth scroll)
```

### DELETE (fly4me remnants)
```
src/pages/Index.tsx          → Delete
src/pages/Work.tsx           → Delete
src/pages/CaseStudy.tsx      → Delete
src/pages/Services.tsx       → Delete
src/pages/About.tsx          → Delete
src/pages/Pricing.tsx        → Delete
src/pages/AreasWeServe.tsx   → Delete
src/pages/AreaPage.tsx       → Delete
src/components/fly4media/    → Delete entire folder
src/data/projects.ts         → Delete
src/data/seoAreas.ts         → Delete
src/App.tsx                  → Gut and rewrite for COG routes
src/pages/NotFound.tsx       → Keep but restyle for COG brand
```

### NEW FOLDERS TO CREATE
```
src/pages/           → COG page files
src/components/cog/  → COG-specific components (SongCard, VoiceMemoCard, WaveformBar, etc.)
src/stores/          → Zustand stores (songStore, playerStore, collaboratorStore)
src/types/           → TypeScript types for all COG domain objects
src/lib/supabase/    → Supabase client + typed query helpers
src/lib/audio/       → Audio recording + playback utilities
```

---

## 7. SOURCE DOCUMENTS — COMPLETE INVENTORY

All source documents live at:
`zip_extracted/20. SONGWRITING SPECIFIC PART/`

**These documents are the spec. Every build decision derives from them. Read before implementing.**

### 7.1 PRODUCT VISION SERIES (15 PDFs)
Location: `2. More Onboarding- System -- with reference images/`

These define the WHY and the emotional arc of the product. Read in order for full context.

| File | What It Contains |
|---|---|
| `COG_Product_Vision_01_Scattered_Ideas_Before_Colors_of_Glory_UX_Build_Handoff.pdf` | The "Before" state — why the problem exists. Voice memos scattered, lyrics in Notes, feedback in texts. |
| `COG_Product_Vision_02_One_Song_One_Private_Room_UX_Build_Handoff.pdf` | The core concept: one song = one private room. The Song Workspace definition. |
| `COG_Product_Vision_03_Song_Workspace_Anatomy_UX_Build_Handoff.pdf` | Full anatomy of the Song Workspace: Lyrics, Voice, Chords, Notes, People panels. |
| `COG_Product_Vision_04_Idea_Captured_Inside_The_Song_Product_Vision_UX_Build_Handoff.pdf` | Quick capture — any idea (text, voice, chord) goes directly into the song's room. |
| `COG_Product_Vision_05_Lyrics_And_Voice_Connected_UX_Build_Handoff.pdf` | How lyrics and voice memos are linked — voice memo attached to a specific lyric section. |
| `COG_Product_Vision_06_Invite_Into_The_Song_Room_Collaboration_Loop_UX_Build_Handoff.pdf` | Collaboration invite flow — sending the invite and what collaborators see. |
| `COG_Product_Vision_07_Simple_Roles_Clear_Control_Collaboration_Loop_UX_Build_Handoff.pdf` | Role system — Owner / Contributor / Reviewer / Viewer + what each can do. |
| `COG_Product_Vision_08_Calm_Activity_Intelligence_UX_Build_Handoff.pdf` | Activity feed — "What changed since you left" — calm, non-overwhelming updates. |
| `COG_Product_Vision_09_Version_History_Protects_The_Song_UX_Build_Handoff.pdf` | Version history — snapshot timeline, restore, original preservation. |
| `COG_Product_Vision_10_Contribution_Credits_Remembered_UX_Build_Handoff.pdf` | Credits ledger — every contributor's work remembered, exportable. |
| `COG_Product_Vision_11_Your_Song_Catalog_UX_Build_Handoff.pdf` | Song Catalog — the grid/list of all songs, song card design. (also in: 20. COG -- ONBOARDING/) |
| `COG_Product_Vision_12_When_One_Song_Becomes_A_Catalog_Product_Vision_UX_Build_Handoff.pdf` | Scaling from 1 song to a full catalog — the catalog view and organization. |
| `COG_Product_Vision_13_Storage_Protects_Creative_Work_UX_Build_Handoff.pdf` | Storage model — free tier limits, paid tier expansion, storage warnings. |
| `COG_Product_Vision_14_Referral_Growth_Through_Collaboration_Distribution_Loop_UX_Build_Handoff.pdf` | Referral growth loop — how collaboration itself drives user acquisition. |
| `COG_Product_Vision_15_Product_Flywheel_Create_Capture_Collaborate_Return_UX_Build_Handoff.pdf` | The full product flywheel — Create → Capture → Collaborate → Return. |

### 7.2 ONBOARDING FLOW (15 PDFs + master flow)
Location: `20. COG -- ONBOARDING/1. Onboarding Flow PDFS - with reference images/`

These define every screen of the new user onboarding experience.

| File | What It Contains |
|---|---|
| `Colors_of_Glory_Screen_1_Phone_Login_UX_Handoff.pdf` | Phone number login (Screen 1) |
| `Colors_of_Glory_Onboarding_Screen_01_Phone_Login_Alternative_Inspo_UX_Handoff.pdf` | Alternative login inspiration/variants |
| `COG_Onboarding_04_Start_First_Song_Core_Onboarding_UX_Build_Handoff.pdf` | "Name your first song" — the first aha moment setup |
| `COG_Onboarding_05_Invite_Preview_Core_Onboarding_UX_Build_Handoff.pdf` | Preview of how the invite system works |
| `COG_Onboarding_06_Founder_Code_Core_Onboarding_UX_Build_Handoff.pdf` | Founder/referral code entry screen |
| `COG_Onboarding_07_First_Song_Workspace_First_Aha_Moment_UX_Build_Handoff.pdf` | First time landing in the song workspace |
| `COG_Onboarding_08_Capture_First_Idea_First_Aha_Moment_UX_Build_Handoff.pdf` | Guided first idea capture (the first aha moment) |
| `COG_Onboarding_09_Voice_Memo_Added_First_Aha_Moment_UX_Build_Handoff.pdf` | After recording first voice memo |
| `COG_Onboarding_10_Lyrics_Chords_First_Aha_Moment_UX_Build_Handoff.pdf` | After adding first lyrics + chords |
| `COG_Onboarding_11_Invite_Collaborator_Collaboration_Loop_UX_Build_Handoff.pdf` | Inviting the first collaborator |
| `COG_Onboarding_12_Collaborator_Permissions_Collaboration_Loop_UX_Build_Handoff.pdf` | Setting role for the collaborator |
| `COG_Onboarding_13_Song_Activity_What_Changed_Collaboration_Loop_UX_Build_Handoff.pdf` | Activity feed revealed for the first time |
| `COG_Onboarding_14_Song_Grid_Catalog_Business_Model_Screens_UX_Build_Handoff.pdf` | Song catalog grid / multi-song view |
| `COG_Onboarding_15_Upgrade_Moment_Business_Model_Screens_UX_Build_Handoff.pdf` | The upgrade/paywall moment |
| `COG_Onboarding_16_Storage_Warning_Business_Model_Screens_UX_Build_Handoff.pdf` | Storage limit warning screen |
| `COG_Onboarding_16_Upgrade_Moment_Business_Model_Screens_UX_Build_Handoff.pdf` | Second upgrade moment variant |
| `COG_Onboarding_18_Referral_Dashboard_Business_Model_Screens_UX_Build_Handoff.pdf` | Referral dashboard screen |
| `master_onboarding_flow.pdf` | Complete master onboarding flow map — READ THIS FIRST before onboarding |

### 7.3 SONG CANVAS / WHITEBOARD FEATURES (15 PDFs)
Location: `4. SONG WRITING CANVAS/`

These define the advanced Song Whiteboard Canvas — the drag-and-drop non-linear song architecture tool.

| File | What It Contains |
|---|---|
| `COG_Product_01_Song_Whiteboard_Canvas_Core_Tree_System_UX_Build_Handoff.pdf` | Core tree system — Ideas Tree + Final Tree structure |
| `COG_Product_02_Two_Tree_Ideas_To_Final_Song_UX_Build_Handoff.pdf` | Two-tree concept: unfiltered ideas → curated final song |
| `COG_Product_03_Instant_Hum_Capture_Hold_To_Record_UX_Build_Handoff.pdf` | Hold-to-record hum capture on the canvas |
| `COG_Product_04_Layered_Voice_Memo_Record_Over_This_UX_Build_Handoff.pdf` | Layered recording — record a new take over an existing one |
| `COG_Product_05_One_Tap_Metronome_Toggle_UX_Build_Handoff.pdf` | One-tap metronome toggle with BPM |
| `COG_Product_06_Listen_Path_Click_To_Sequence_UX_Build_Handoff.pdf` | Listen Path — click to create a playback sequence through sections |
| `COG_Product_07_Compare_Mode_Chorus_A_vs_B_UX_Build_Handoff.pdf` | Compare Mode — A vs B side-by-side comparison of two section variants |
| `COG_Product_08_Merge_Splice_Ideas_Into_New_Section_UX_Build_Handoff.pdf` | Merge/Splice — combine two idea nodes into a new section |
| `COG_Product_09_Line_Level_Suggestion_Replace_Just_This_Line_UX_Build_Handoff.pdf` | Line-level suggestion — collaborator suggests a replacement for one lyric line |
| `COG_Product_10_Story_Scripture_Meaning_Zone_UX_Build_Handoff.pdf` | Story/Scripture/Meaning Zone — attach Bible verse, story note, or theme to a section |
| `COG_Product_11_Owner_Review_Queue_Pending_Ideas_UX_Build_Handoff.pdf` | Owner review queue — pending ideas from collaborators waiting for approval |
| `COG_Product_12_What_Changed_Smart_Recap_UX_Build_Handoff.pdf` | Smart recap — "here's what changed while you were away" canvas summary |
| `COG_Product_13_Contribution_Ledger_Credits_Review_UX_Build_Handoff.pdf` | Credits ledger on the canvas — who contributed what |
| `COG_Product_14_Final_Arrangement_Drag_Mode_UX_Build_Handoff.pdf` | Final arrangement drag mode — drag sections into final song order |

Also in this folder (feature-level implementation docs):
- `Canvas Feature 1.docx`, `Feature 2, 3, 6 UX + Implementation Plan.docx`
- `Colors_of_Glory_32_Songwriting_Engine_Feature_Roadmap.pdf` — Full 32-feature roadmap

### 7.4 SYSTEM OPERATIONS / FEATURE IMPLEMENTATION (30+ PDFs)
Location: `3. System operations/`

These are granular UX + implementation plans for individual features. Each one contains: screen flows, interaction logic, component specifications, and implementation notes.

| File | Feature |
|---|---|
| `COG_Feature_04_Song_Whiteboard_Canvas_UX_Build_Handoff.pdf` | Song Whiteboard Canvas (F4) |
| `COG_Feature_05_Ideas_Tree_and_Final_Tree_UX_Implementation_Plan.pdf` | Ideas Tree + Final Tree (F5) |
| `COG_Feature_07_Idea_Cards_Fragment_Pipeline_UX_Implementation_Plan.pdf` | Idea Cards + Fragment Pipeline (F7) |
| `COG_Feature_09_Instant_Hum_Capture_Capture_Audio_UX_Build_Handoff.pdf` | Instant Hum Capture (F9) |
| `COG_Feature_10_Voice_Memo_Cards_and_Waveforms_UX_Implementation_Plan.pdf` | Voice Memo Cards + Waveforms (F10) |
| `COG_Feature_11_Voice_Memo_Inbox_Existing_Audio_Import_UX_Implementation_Plan.pdf` | Voice Memo Inbox + Audio Import (F11) |
| `COG_Feature_12_Auto_Transcription_Lyrics_From_Transcript_UX_Build_Handoff.pdf` | Auto Transcription → Lyrics (F12) |
| `COG_Feature_13_BPM_Key_Melody_and_Chord_Detection_UX_Implementation_Plan.pdf` | BPM / Key / Chord Detection (F13) |
| `COG_Feature_14_One_Tap_Metronome_UX_Product_Implementation_Plan.pdf` | One-Tap Metronome (F14) |
| `COG_Feature_15_Loop_This_Part_Swipe_Between_Takes_UX_Implementation_Plan.pdf` | Loop + Swipe Between Takes (F15) |
| `COG_Feature_17_Lyrics_and_Chords_Editor_Shape_Arrange_UX_Build_Handoff.pdf` | Lyrics + Chords Editor (F17) |
| `COG_Feature_18_Section_Nodes_and_Custom_Section_Labels_UX_Implementation_Plan.pdf` | Section Nodes + Custom Labels (F18) |
| `COG_Feature_19_Line_Level_Suggestions_Replace_Just_This_Line_UX_Implementation_Plan.pdf` | Line-Level Suggestions (F19) |
| `COG_Feature_20_Listen_Path_UX_Build_Handoff.pdf` | Listen Path (F20) |
| `COG_Feature_21_Compare_Mode_UX_Implementation_Plan.pdf` | Compare Mode (F21) |
| `COG_Feature_22_Merge_And_Splice_Ideas_UX_Product_Implementation_Plan.pdf` | Merge + Splice Ideas (F22) |
| `COG_Feature_23_Final_Arrangement_Drag_Mode_UX_Implementation_Plan.pdf` | Final Arrangement Drag Mode (F23) |
| `COG_Feature_33_Personal_Memory_Graph_Zettelkasten_UX_Build_Handoff.pdf` | Personal Memory Graph / Zettelkasten (F33) |
| `COG_Songwriting_Engine_Feature_08_Universal_Quick_Capture_UX_Product_Implementation_Plan.pdf` | Universal Quick Capture (F8) |
| `COG_Songwriting_Engine_Feature_16_Layered_Voice_Memo_Recording_UX_Product_Implementation_Plan.pdf` | Layered Voice Memo Recording (F16) |
| `COG_Songwriting_Engine_Feature_24_Version_History_Undo_Original_Preservation_UX_Product_Implementation_Plan.pdf` | Version History + Undo + Original Preservation (F24) |

Also:
- `Plan for 3. system operations_.docx` — overall system operations architecture plan

### 7.5 BUSINESS MODEL / MONETIZATION
Location: `0.1 Songwriting full payment plan and structure/`

| File | What It Contains |
|---|---|
| `COG_First_Song_Free_Irresistible_Invite_Lead_Magnet_Funnel.pdf` | Free tier funnel — "First Song Free" lead magnet strategy |
| `COG_First_Song_Free_Lead_Magnet_Sales_Funnel_Strategy.pdf` | Full sales funnel strategy — free→paid conversion |
| `Free version/` subfolder | Free tier feature scope |

### 7.6 MASTER PLANNING DOCUMENTS
Location: root of `zip_extracted/20. SONGWRITING SPECIFIC PART/`

| File | What It Contains |
|---|---|
| `MASTER - ALL 1000 colors_of_glory_songwriting_features_roadmap.xlsx` | Master feature roadmap spreadsheet — all ~32+ features prioritized |
| `SONG WRITING FEATURES MASTER LIST.docx` | Full feature list narrative document |

---

## 8. REFERENCE IMAGES — VISUAL MOCKUPS

Location: `zip_extracted/20. SONGWRITING SPECIFIC PART/2. More Onboarding- System -- with reference images/reference images/`

These are the approved design mockups. Every UI component must match these.

| File | Shows |
|---|---|
| `download.png` | Invite flow — "Invite someone into this song" + "You've been invited" screens |
| `download (14).webp` | **"Before Colors of Glory"** — the problem: scattered tools across 3 apps |
| `download (15).webp` | **Song Workspace hub screen** — the 5-panel grid (Lyrics, Voice, Chords, Notes, People) |
| `download (16).webp` | **Full workspace annotated** — Capture raw ideas, Write lyrics, Track chords, Keep feedback, Remember changes |
| `download (17).webp` | **Voice recording screen** — hold to record, timer, "Save memo" button + saved state with waveform |
| `download (18).webp` | **Lyrics + Chords editor** — serif song title, "Verse 1" label, chord chips (C, G, Am) above lyric lines, voice memo embedded, "Add section" + "Record idea" CTAs |
| `download (19).webp` | **Role selection** — "Choose their role": Viewer / Contributor (selected, gold border) / Reviewer + "Confirm role" button |
| `download (20).webp` | **Activity feed** — "What changed since you left": Sarah added voice memo, Parker edited Verse 2, Caleb suggested chord change, 2 comments need review |
| `download (21).webp` | **Credits Review** — Parker (Owner · Lyrics · Arrangement), Sarah (Voice memo · Bridge idea), Caleb (Chord suggestion · Chorus review), "Export credits" button |
| `download (22).webp` | *(Check file for content)* |
| `download (23).webp` | *(Check file for content)* |
| `download (24).webp` | *(Check file for content)* |
| `download (25).webp` | *(Check file for content)* |

Onboarding reference images also at:
`zip_extracted/20. SONGWRITING SPECIFIC PART/20. COG -- ONBOARDING/1. Onboarding Flow PDFS - with reference images/Onboarding reference images/`

---

## 9. DOCUMENT READING PROTOCOL

**Before implementing any feature, read its source document first.**

The correct process for every work session:

```
1. IDENTIFY which feature/screen is being built
2. LOCATE the corresponding document(s) from Section 7 above
3. READ the document using the Read tool (PDFs support pages parameter)
4. EXTRACT: screen flows, interaction states, component specs, copy strings
5. REFERENCE the visual mockups from Section 8 to verify visual language
6. THEN build — screen by screen, component by component
```

**Reading order for a fresh start:**

Phase 1 — Foundation context:
- Read all 15 Product Vision PDFs (Section 7.1) — understand the WHY
- Read `master_onboarding_flow.pdf` — understand the user journey
- Read `SONG WRITING FEATURES MASTER LIST.docx` (if readable)

Phase 2 — Core build (build in this order):
1. Database schema (Supabase) — derived from Section 5 above
2. Auth + Onboarding screens (Section 7.2)
3. Song Catalog page
4. Song Workspace hub (the 5-panel room)
5. Lyrics + Chords editor (Feature 17)
6. Voice Memo capture + playback (Features 9, 10, 16)
7. Collaborators + Roles (Product Vision 6, 7)
8. Activity Feed (Product Vision 8)
9. Version History (Feature 24)
10. Credits (Product Vision 10)
11. Song Canvas / Whiteboard (Features 4, 5 — advanced)
12. Business model screens: upgrade, storage warning, referral

---

## 10. ACTIVE PERSONAS

All global personas from `~/.claude/CLAUDE.md` remain active. The following are specifically relevant to this project:

**Primary persona activations:**
- **General Design Mode** (prompt-library.md §1) — active for all UI work
- **Christian / Ministry Mode** (prompt-library.md §10) — ALWAYS active on this project. Colour, shape, motion language must reflect faith-based spiritual intentionality
- **Elite Engineering Methodology** (persona-engineering-methodology.md) — active for all implementation work
- **Systems Architect** (persona-systems-architect.md) — active for data model, Supabase schema, collaboration workflow design

**Design standard reminder:** Fantasy.co × Apple UX. Every component earns its place. The warmth of the cream palette and gold accents communicates spiritual warmth, not tech-startup polish.

---

## 11. KEY PRODUCT DECISIONS (DO NOT REVISIT)

These are locked. Do not design around or debate them:

1. **Mobile-first.** The primary experience is a mobile app (iOS aesthetic). Desktop is a tablet/web companion. Every component designed at 390px width first.
2. **One song = one private room.** The Song Workspace is the central metaphor. Never break this.
3. **Warm cream + gold.** The design language is non-negotiable. Not dark mode by default. Not corporate blue. Not generic white.
4. **Serif for song titles and headings.** This is not a note-taking app. It's a creative sanctuary.
5. **Gold CTAs.** Primary buttons are always gold (`var(--cog-gold)`). Never blue, never generic gray.
6. **Free first song.** The free tier gives exactly one song. The second song triggers upgrade.
7. **Collaboration is the growth loop.** Every invite sent is an acquisition event. Build collaboration flows to be beautiful.
8. **Voice memos are first-class citizens.** Audio is not an attachment — it is core content equal to lyrics.
9. **Calm, non-overwhelming UX.** No red badge counts, no notification spam, no aggressive upsell banners. The app should feel like a creative sanctuary.
10. **Credits matter.** Every contributor's work is acknowledged and exportable. This is a core value for worship/co-writing communities.

---

## 12. WHAT DOES NOT EXIST YET

The following still need to be designed from the spec documents before building:
- Payment/subscription tiers (exact feature gates per tier)
- Storage quotas per tier
- The Song Canvas whiteboard interaction model (complex)
- Auto-transcription (likely requires external API — Whisper or similar)
- BPM/Key/Chord detection (likely requires audio analysis API)
- Push notifications design
- Export formats (PDF lyrics sheet, credits PDF, audio export)

When reaching these features, read the corresponding spec document before making any architecture decisions.

---

*Last updated: 2026-06-02 | Project: Colors of Glory | Studio: Fantasy.co*
*This CLAUDE.md overrides all fly4me context. This is a fresh build.*
