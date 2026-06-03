# COLORS OF GLORY — MASTER OUTPUTS
## Generated from full document review: all 69 PDFs + all reference images
## Date: 2026-06-02

---

## OUTPUT 1 — COMPLETE SCREEN INVENTORY

| # | Screen Name | Route | Source Doc(s) | Primary User Action |
|---|---|---|---|---|
| 1 | Phone Login | `/auth/login` | Screen_1_Phone_Login | Enter phone → Continue |
| 2 | Code Verification | `/auth/verify` | master_onboarding_flow | Enter 6-digit OTP |
| 3 | First Intent (Start or Join) | `/auth/intent` | master_onboarding_flow | Tap "Start a song" or accept invite |
| 4 | Start First Song | `/onboarding/start-song` | Onboarding_04 | Type song name → Create |
| 5 | Invite Preview (Join from invite) | `/invite/:token` | Vision_06, Onboarding_05 | Tap "Open song" |
| 6 | Founder Code | `/onboarding/founder-code` | Onboarding_06 | Enter code → "Unlock access" |
| 7 | Song Catalog | `/` | Vision_11, Onboarding_14 | Open a song card or tap "+ New song" |
| 8 | Song Workspace Hub | `/songs/:id` | Vision_02, Vision_03, Onboarding_07, Feature_02 | Tap module card (Lyrics/Voice/Chords/Notes/People) |
| 9 | Capture First Idea | `/songs/:id/capture` | Onboarding_08, Feature_09 | Tap "Record voice memo" or "Write lyrics instead" |
| 10 | Voice Memo Added (saved state) | `/songs/:id/voice` | Onboarding_09, Feature_10 | Play / Rename / Add note |
| 11 | Lyrics + Chords Editor | `/songs/:id/lyrics` | Onboarding_10, Feature_17 | Write lyrics, tap chord chips, "Add section" |
| 12 | Voice Memos Full View | `/songs/:id/voice` | Feature_10, Feature_11 | Play memo, record new, upload existing |
| 13 | Notes | `/songs/:id/notes` | Vision_03 | Write free-form notes |
| 14 | Collaborators / Invite | `/songs/:id/people` | Vision_06, Onboarding_11 | Enter phone/email → Select role → "Send invite" |
| 15 | Role Selection (sheet) | Sheet over /people | Vision_07, Onboarding_12 | Tap Viewer / Contributor / Reviewer → "Confirm role" |
| 16 | Activity Feed | `/songs/:id/activity` | Vision_08, Onboarding_13 | "Review changes" or "Open song" |
| 17 | Version History (drawer) | Sheet over any workspace | Vision_09, Feature_24 | Tap version → "Restore version" |
| 18 | Credits Review | `/songs/:id/credits` | Vision_10 | Review cards → "Export credits" |
| 19 | Upgrade Moment (sheet) | Sheet triggered by plan limit | Vision_12, Onboarding_15 | "Go Pro" or "Keep using Free" |
| 20 | Storage Warning | `/settings/storage` | Vision_13, Onboarding_16 | "Add storage" or "Manage files" |
| 21 | Referral Dashboard | `/settings/referral` | Vision_14, Onboarding_18 | "Copy link" or "Share invite" |
| 22 | Account Settings | `/settings` | — | Manage profile, plan, sign out |
| 23 | Song Canvas / Whiteboard | `/songs/:id/canvas` | Feature_04, Feature_05 (Phase 2+) | Drag idea cards, tap branches |
| 24 | Not Found | `/*` | — | Navigate back |

---

## OUTPUT 2 — COMPLETE COMPONENT LIBRARY

### Shell & Layout
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `AppShell` | `children` | All authenticated screens | Bottom tab bar (4 icons: Home, Songs, Search, Profile) + floating gold "+" FAB |
| `BottomTabBar` | `activeTab` | All main screens | 4 icon tabs, cream bg, gold active indicator |
| `FloatingCaptureFAB` | `songId?` | Song workspace screens | Gold circle "+", 56px, shadow, centered at bottom |
| `SongRoomShell` | `songId, glow?` | Song workspace | Full-screen cream canvas, radial glow, no dashboard chrome |
| `GlowLayer` | `intensity?` | Song workspace screens | `radial-gradient(ellipse 60% 40% at 50% 85%, rgba(184,149,58,0.18) 0%, transparent 70%)` |
| `SafeAreaWrapper` | `children` | All mobile screens | Respects iOS notch/Dynamic Island, home indicator |

### Authentication
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `PhoneInput` | `value, onChange` | Login | Flag + country code + number field, cream bg, charcoal text |
| `OTPInput` | `value, onChange, length=6` | Verify | 6 separate digit boxes, gold focus ring |
| `AuthCard` | `title, subtitle, children` | Auth screens | Centered, large serif headline, calm layout |

### Song Catalog
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `SongCatalog` | `activeTab` | Catalog | Full screen, large "Your songs" heading, tab switcher |
| `CatalogTabs` | `tabs: [Owned, Invited, Archived], active` | Catalog | Pill-style tabs, cream bg, active pill white with shadow |
| `SongCard` | `song, variant: owned\|invited\|archived` | Catalog | 16px rounded, cream-light bg, gold tone gradient, status chip, avatar stack, last-edited |
| `StatusChip` | `status: Active\|Draft\|Collaborating\|Private\|Review\|Archived` | SongCard | Small pill, 10px radius, muted bg, small type |
| `AvatarStack` | `users[], max=3` | SongCard, workspace | Overlapping 24px avatars with initials fallback |
| `NewSongSheet` | `onCreated` | Catalog | Bottom sheet, single text input "Name your song", gold CTA |

### Song Workspace Hub
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `SongWorkspaceHub` | `song, role` | Workspace hub | Song title (serif, 38-46px), "Private song room" subtitle, 5-module card grid |
| `SongTitleHeader` | `title, subtitle, saveState` | Workspace | Large Playfair Display title, muted subtitle, autosave indicator |
| `ModuleCardGrid` | `modules[], songId` | Workspace hub | 3-over-2 grid (or list on return user), 88-104px cards |
| `ModuleCard` | `label, icon, route, disabled?` | Workspace hub | Rounded 16px, cream-light bg, icon + label, hover/press states |
| `BrandMark` | `size: sm\|md` | Multiple | "Colors of Glory" wordmark, small + centered |
| `SupportLine` | `text` | Workspace | Muted centered caption, "Everything for this song stays connected here." |

### Lyrics + Chords Editor
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `LyricsChordsEditorPage` | `songId` | Lyrics editor | Full screen editor with song header, mode tabs, section list |
| `SongModeSwitcher` | `modes: [Lyrics, Chords, Voice, Notes], active` | Lyrics editor | Horizontal pill tabs below song header |
| `SectionRail` | `sections[], activeId` | Lyrics editor | Left rail (desktop) or scrollable section list |
| `SectionEditor` | `section, lines, permissions` | Lyrics editor | Editable section with serif lines, generous spacing |
| `SectionLabel` | `label: 'Verse 1'\|'Chorus'\|'Bridge'...` | Lyrics editor | Bold serif 1.25rem, charcoal, left-aligned |
| `ChordChip` | `chord, onClick?` | Lyrics editor | Small gold-pale badge above lyric line, e.g. "C", "G", "Am" |
| `ChordEntrySheet` | `lineId, onSave` | Lyrics editor | Bottom sheet with chord input, key context |
| `LineActionMenu` | `lineId, permissions` | Lyrics editor | Context menu: Suggest line, Add chord, Delete |
| `AutosaveIndicator` | `state: saving\|saved\|offline\|error` | Lyrics editor | Small muted text "Saved just now" / "Saving..." |
| `LyricLine` | `text, chords[], editable` | Lyrics editor | Single line of lyrics with chord chips positioned above |

### Voice Memos
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `SongVoicePage` | `songId, role` | Voice memos | List of memo cards + "Record" floating action |
| `VoiceMemoList` | `memos[], role` | Voice | Vertical card list, newest first |
| `VoiceMemoCard` | `memo, permissions` | Voice | Rounded cream card, waveform area, play btn, contributor chip, duration, actions |
| `WaveformBar` | `data[], isPlaying, position` | VoiceMemoCard | Gold bars, animated on playback, soft/minimal |
| `VoiceMemoRecorder` | `songId, onSaved` | Capture/Voice | Large gold mic button centered, timer, "Recording..." state, pulse ring |
| `VoiceMemoDetailSheet` | `memo` | Voice | Bottom sheet with waveform, rename, add note, share, section link |
| `RecordingRing` | `isRecording` | Recorder | Slow calm gold pulse, not flashing red |

### Collaboration
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `InviteSheet` | `songId, onSent` | People / Invite | Bottom sheet: phone/email input + role selector + "Send invite" gold CTA |
| `RoleSelector` | `selected, onChange` | Invite/Role screens | 3 cards: Viewer / Contributor (default selected) / Reviewer, gold border on selected |
| `RoleCard` | `role, description, selected` | Role selector | White card, 16px radius, role name + description, gold border when selected |
| `CollaboratorRow` | `user, role, onChangeRole?` | People | Avatar + name + role chip + action menu |
| `InviteSuccessState` | `—` | After invite sent | "Invitation Sent!" with confirm copy |

### Activity & History
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `ActivityFeedPage` | `songId` | Activity | "What changed since you left" headline, digest cards, "Review changes" CTA |
| `ActivityItem` | `actor, action, time, target` | Activity | Actor name bold + action text + time, minimal icon |
| `VersionHistorySheet` | `songId, onRestore` | Versions drawer | Timeline: Today/Yesterday/Earlier groups, human summaries, "Restore version" |
| `VersionItem` | `version, onRestore` | Versions | Dot + actor + time + summary + restore action |

### Credits & Business Model
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `CreditsReviewPage` | `songId` | Credits | "Credits Review" + song context + contributor cards |
| `CreditCard` | `user, contributions[]` | Credits | Cream card, name + role chip + contribution type pills |
| `UpgradeSheet` | `trigger: 'second-song'\|'storage'\|'feature'` | Upgrade | Bottom sheet: Free vs Pro comparison, "Go Pro" / "Keep using Free" |
| `PlanCard` | `plan: Free\|Pro, features[]` | Upgrade | Cream card, plan name, feature list, price |
| `StorageWarningPage` | `usage, total` | Storage | Progress bar (gold), "Your songs are safe.", category rows, "Add storage" |
| `StorageProgressBar` | `used, total` | Storage | Gold fill, cream track, 8px height |
| `ReferralDashboard` | `referralCode, stats` | Referral | Link pill + 4 stat tiles + "Copy link" dark CTA |
| `StatTile` | `label, value, icon` | Referral | White card, icon + stat + label |

### Common/Utility
| Component | Props/Variants | Screens | Visual Spec |
|---|---|---|---|
| `GoldButton` | `size: sm\|md\|lg, fullWidth?` | All | `bg-[#B8953A]` white text, 14px radius, `scale(0.97)` on press |
| `GhostButton` | `size: sm\|md` | All | White bg, `var(--cog-border)` border, charcoal text |
| `TextButton` | `—` | All | No bg/border, gold text for secondary actions |
| `CalmStatus` | `state, message` | Editor, workspace | Small muted text, no red by default |
| `PermissionNotice` | `message` | Role-gated views | Inline non-blocking notice with plain-language text |
| `EmptyState` | `title, body, action?` | Any empty view | Centered, calm, no scary icons |
| `SkeletonCard` | `—` | Loading | Cream skeleton bars, no spinners |
| `InlineError` | `message, onRetry` | Any error | Calm non-red inline recovery copy |

---

## OUTPUT 3 — SUPABASE SCHEMA (FINAL)

```sql
-- USERS & AUTH
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  name text,
  avatar_url text,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro', 'founder')),
  referral_code text unique,
  referred_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WORKSPACES (billing/storage owner)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  plan_tier text not null default 'free',
  storage_cap_bytes bigint not null default 536870912, -- 500MB free default
  storage_used_bytes bigint not null default 0,
  created_at timestamptz default now()
);

-- SONGS (the core object)
create table songs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references users(id),
  title text not null default 'Untitled Song',
  key text,
  bpm integer,
  status text not null default 'draft' check (status in ('draft', 'active', 'review', 'archived')),
  is_archived boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SONG SECTIONS
create table song_sections (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  type text not null default 'verse' check (type in ('verse', 'chorus', 'bridge', 'pre-chorus', 'outro', 'intro', 'custom')),
  label text not null default 'Verse 1',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- LYRIC LINES
create table lyric_lines (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references song_sections(id) on delete cascade,
  text text not null default '',
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CHORD POSITIONS (attached to lyric lines)
create table chord_positions (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references lyric_lines(id) on delete cascade,
  chord_name text not null,
  char_position integer not null default 0
);

-- CHORD CHARTS (song-level key/BPM/progression)
create table chord_charts (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade unique,
  key text,
  bpm integer,
  progression text
);

-- SONG NOTES (free-form, one per song)
create table song_notes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade unique,
  content text not null default '',
  updated_at timestamptz default now()
);

-- VOICE MEMOS
create table voice_memos (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  section_id uuid references song_sections(id),
  owner_id uuid not null references users(id),
  storage_url text,
  waveform_data jsonb,
  duration_seconds numeric(8,2),
  title text not null default 'Voice Memo',
  transcript text,
  status text not null default 'uploading' check (status in ('uploading', 'saved', 'failed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SONG MEMBERS (collaborators)
create table song_members (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  user_id uuid not null references users(id),
  role text not null default 'viewer' check (role in ('owner', 'contributor', 'reviewer', 'viewer')),
  invited_by uuid references users(id),
  accepted_at timestamptz,
  created_at timestamptz default now(),
  unique(song_id, user_id)
);

-- INVITE TOKENS
create table invite_tokens (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  email text,
  phone text,
  role text not null default 'contributor' check (role in ('contributor', 'reviewer', 'viewer')),
  token text not null unique default gen_random_uuid()::text,
  inviter_id uuid not null references users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- VERSION SNAPSHOTS
create table versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  snapshot_json jsonb not null,
  created_by uuid not null references users(id),
  label text,
  human_summary text,
  created_at timestamptz default now()
);

-- ACTIVITY LOG
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  user_id uuid not null references users(id),
  action_type text not null,
  entity_type text,
  entity_id text,
  summary text not null,
  created_at timestamptz default now()
);

-- CREDITS
create table credits (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  user_id uuid not null references users(id),
  contribution_types text[] not null default '{}',
  updated_at timestamptz default now(),
  unique(song_id, user_id)
);

-- REFERRALS
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id),
  referee_id uuid not null references users(id),
  referral_code text not null,
  reward_amount_cents integer not null default 1000,
  payout_status text not null default 'pending' check (payout_status in ('pending', 'active', 'payable', 'paid')),
  created_at timestamptz default now()
);

-- FOUNDER CODES
create table founder_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_tier text not null default 'pro',
  duration_days integer,
  max_uses integer not null default 1,
  uses_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- RLS POLICIES (abbreviated — enable for all tables)
alter table songs enable row level security;
alter table song_members enable row level security;
alter table voice_memos enable row level security;
-- ... (full RLS per table in implementation)
```

---

## OUTPUT 4 — BUILD PRIORITY QUEUE

### Phase 0 — Cleanup (do first, ~30 min)
| # | Task | Dependencies | Size |
|---|---|---|---|
| 0.1 | Delete all fly4me pages (Index, Work, CaseStudy, Services, About, Pricing, AreasWeServe, AreaPage) | none | S |
| 0.2 | Delete `src/components/fly4media/` folder | none | S |
| 0.3 | Delete `src/data/projects.ts`, `src/data/seoAreas.ts` | none | S |
| 0.4 | Delete `src/lib/seo.ts` | none | S |
| 0.5 | Gut and rewrite `src/App.tsx` with COG routes | none | S |
| 0.6 | Create `src/styles/tokens.css` with COG design tokens | none | S |
| 0.7 | Update `src/index.css` to import tokens and set base styles | none | S |

### Phase 1 — Auth + First Screen (Day 1-2)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 1.1 | `PhoneLoginPage` — phone input + Continue button | Auth setup | M | Screen_1_Phone_Login |
| 1.2 | `CodeVerifyPage` — OTP 6-digit entry | 1.1 | M | master_onboarding_flow |
| 1.3 | Supabase phone auth integration | 1.1, 1.2 | M | — |
| 1.4 | `FirstIntentPage` — Start or Join routing | 1.3 | S | master_onboarding_flow |
| 1.5 | `StartFirstSongPage` — name input + create | 1.4, DB | S | Onboarding_04 |
| 1.6 | `FounderCodePage` — code redemption + skip | 1.5 | S | Onboarding_06 |

### Phase 2 — Song Catalog + Workspace Hub (Day 3-4)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 2.1 | Supabase schema migration (all tables) | Phase 1 | L | Schema above |
| 2.2 | `SongCatalogPage` — Owned/Invited/Archived tabs + song cards | 2.1 | M | Vision_11, Onboarding_14 |
| 2.3 | `SongCard` component with status chip, avatars, last-edited | 2.1 | M | Vision_11, reference img 22 |
| 2.4 | `NewSongSheet` — create song modal | 2.2 | S | Onboarding_04 |
| 2.5 | `SongWorkspaceHub` — 5-module card grid | 2.1 | M | Vision_02, Vision_03 |
| 2.6 | `AppShell` with bottom tab bar + floating "+" FAB | 2.2 | M | reference img 25 |
| 2.7 | `GlowLayer` component for workspace screens | 2.5 | S | CLAUDE.md design system |

### Phase 3 — Voice Memo Capture (Day 5-7)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 3.1 | `CaptureFirstIdeaPage` — large gold mic + recorder | 2.5 | M | Onboarding_08, Feature_09 |
| 3.2 | Audio recording via MediaRecorder API | 3.1 | M | Feature_09 |
| 3.3 | Upload recording to Supabase Storage | 3.2 | M | Feature_09 |
| 3.4 | `VoiceMemoCard` — waveform + controls | 3.3 | M | Vision_04, Feature_10 |
| 3.5 | `WaveformBar` — visual waveform from audio | 3.4 | M | Feature_10 |
| 3.6 | `SongVoicePage` — memo list | 3.4 | M | Feature_10 |
| 3.7 | Playback with HTMLAudioElement | 3.5 | M | Feature_10 |

### Phase 4 — Lyrics + Chords Editor (Day 8-10)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 4.1 | `LyricsChordsEditorPage` — full writing surface | 2.5 | L | Onboarding_10, Feature_17 |
| 4.2 | `SectionEditor` — lyric lines, autosave | 4.1 | M | Feature_17 |
| 4.3 | `ChordChip` — inline chord annotations | 4.1 | S | Vision_05, Feature_17 |
| 4.4 | `ChordEntrySheet` — add/edit chords | 4.3 | S | Feature_17 |
| 4.5 | Autosave with debounce (write to Supabase) | 4.2 | M | Feature_17 |
| 4.6 | `AutosaveIndicator` — "Saved just now" | 4.5 | S | Feature_17 |
| 4.7 | `SongModeSwitcher` tabs (Lyrics/Chords/Voice/Notes) | 4.1 | S | Onboarding_10 |

### Phase 5 — Collaboration (Day 11-13)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 5.1 | `InviteSheet` — phone/email + role + Send invite | 2.5 | M | Vision_06, Onboarding_11 |
| 5.2 | `RoleSelector` — Viewer/Contributor/Reviewer cards | 5.1 | S | Vision_07, Onboarding_12 |
| 5.3 | Invite token creation + email/SMS delivery | 5.1 | M | Feature_26 |
| 5.4 | `InvitePreviewPage` — accept invite flow | 5.3 | M | Onboarding_05, Vision_06 |
| 5.5 | `CollaboratorRow` + People tab in workspace | 5.1 | M | Vision_03 |

### Phase 6 — Intelligence Layer (Day 14-16)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 6.1 | `ActivityFeedPage` — "What changed since you left" | 5.1 | M | Vision_08, Onboarding_13 |
| 6.2 | Activity logging on all key actions | 5.1 | M | Feature_29 |
| 6.3 | `VersionHistorySheet` — timeline + restore | 4.5 | M | Vision_09, Feature_24 |
| 6.4 | Version snapshot creation on key edits | 4.5 | M | Feature_24 |
| 6.5 | `CreditsReviewPage` — contributor cards + export | 5.5 | M | Vision_10 |

### Phase 7 — Business Model Screens (Day 17-18)
| # | Task | Dependencies | Size | Source Doc |
|---|---|---|---|---|
| 7.1 | `UpgradeSheet` — Free vs Pro comparison | Plan limit logic | M | Vision_12, Onboarding_15 |
| 7.2 | Plan limit enforcement (1 owned song free) | 2.1 | M | Business model docs |
| 7.3 | `StorageWarningPage` — usage + categories | 3.3 | S | Vision_13, Onboarding_16 |
| 7.4 | `ReferralDashboard` — link + 4 stat tiles | 7.1 | M | Vision_14, Onboarding_18 |

### Phase 8 — Advanced Features (Future)
| # | Task | Size | Source Doc |
|---|---|---|---|
| 8.1 | Song Canvas / Whiteboard | XL | Feature_04, Feature_05 |
| 8.2 | Auto-transcription (Whisper API) | XL | Feature_12 |
| 8.3 | BPM/Key detection | L | Feature_13 |
| 8.4 | Listen Path | L | Feature_20 |
| 8.5 | Compare Mode | L | Feature_21 |
| 8.6 | Layered Voice Memo Recording | L | Feature_16 |

---

## OUTPUT 5 — DESIGN TOKEN FILE

See: `src/styles/tokens.css`

---

## FREE vs PRO PLAN BOUNDARY

| Feature | Free | Pro (~$50/mo) |
|---|---|---|
| Owned active songs | 1 | 50 |
| Storage | 500MB–1GB | 100GB |
| Voice recording/upload | Basic within storage cap | Full: waveform, tagging, playback |
| Invite collaborators | Yes | Yes |
| Join invited songs | Unlimited | Unlimited |
| Version history | Recent/basic snapshots | Extended + recovery + diffs |
| Lyrics/chords editing | Basic | Advanced (section versions, exports) |
| Credits export | No | Yes |
| Clean PDF export | No | Yes |
| Collaboration depth | Basic (comments, suggestions) | Full (layered recording, Listen Path, metronome) |
| AI transcription | No | Yes (within plan limits) |
| Referral earning | $10/month per direct Pro referral | Same |

---

## KEY COPY STRINGS (Approved verbatim from docs)

```
Login:          "Welcome / Enter your phone number to continue / Continue"
                "We will send a secure one-time code. No password needed."
                "Use email instead"

Song Workspace: "Private song room"
                "Everything for this song stays connected here."
                "Start anywhere. Add a lyric, record a voice memo, or invite someone into the song."

Recording:      "Recording... 0:28"
                "Save memo"
                "Saved to Grace in the Waiting"
                "Saved locally. Syncing to the song..."
                "Your idea is saved."

Invite:         "Invite someone into this song"
                "Phone or email"
                "Send invite"
                "Invited songs do not use their free song."
                "You've been invited"
                "Open song"

Roles:          "Choose their role"
                "Viewer - Can listen and read."
                "Contributor - Can add lyrics, memos, comments, and ideas."
                "Reviewer - Can comment and approve changes."
                "Confirm role"

Activity:       "What changed since you left"
                "Review changes"
                "Open song"

Versions:       "Version history"
                "Restore version"
                "Restoring saves your current version first."

Credits:        "Credits Review"
                "Export credits"
                "Edit roles"

Catalog:        "Your songs"
                "Owned / Invited / Archived"
                "+ New song"

Upgrade:        "Ready to build your catalog?"
                "Free includes one active owned song. Upgrade to Pro when one song becomes a real workspace."
                "Go Pro"
                "Keep using Free"

Storage:        "You're almost out of storage"
                "Your songs are safe, but new uploads may pause soon."
                "Add storage"
                "Manage files"

Founder:        "Have a founder code?"
                "Enter it here to unlock your private access."
                "Unlock access"
                "I will do this later"

Referral:       "Invite songwriters. Earn monthly."
                "You earn $10/month while each direct referral stays on Pro."
                "Copy link"

Errors (never technical):
                "We could not save that change. Your draft is still here."
                "We could not send this invite. Please try again."
                "We could not load your songs. Please try again."
                "We could not open that section. Please try again."
```

---

*Generated 2026-06-02 from full document review — Colors of Glory × Fantasy.co*
