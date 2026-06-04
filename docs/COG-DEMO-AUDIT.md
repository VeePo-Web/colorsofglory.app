# Colors of Glory — Full Demo Audit
## State as of: 2026-06-03 | Branch: codex/codex-operating-plan

---

## DEMO FLOW STATUS

### ✅ COMPLETE — Ready to demo now

| Screen | Route | Notes |
|--------|-------|-------|
| Phone Login | `/auth/login` | OTP input, gold CTA, "No password needed" |
| Code Verify | `/auth/verify` | 6 OTP boxes, auto-advance, paste, 30s resend |
| First Intent | `/onboarding/intent` | Start a song / Join a song routing cards |
| Start First Song | `/onboarding/start-song` | Title + Key + BPM + skip path |
| Founder Code | `/onboarding/founder-code` | Code input + success state "Founder access unlocked" |
| Invite Preview | `/invite/:token` | Song card, role chip, "Invited songs do not use your free song" |
| Song Workspace | `/songs/:id` | 5 module cards (Lyrics/Voice/Chords/Notes/People), warm glow |
| Capture First Idea | `/songs/:id/capture` | 120px mic button, pulse rings, record animation |
| Voice Memo Added | `/songs/:id/voice-added` | Waveform card, success state, "Return to song" |
| Lyrics Editor | `/songs/:id/lyrics` | 4-tab bar, chord chips, section labels, autosave |
| Voice Memos | `/songs/:id/voice` | Waveform cards, play/pause, record CTA |
| Notes | `/songs/:id/notes` | Clean textarea, saved note chips |
| People / Invite | `/songs/:id/people` | Invite form, role chips, success state, collaborator list |
| Activity Feed | `/songs/:id/activity` | "What changed since you left", 4 activity cards, aurora accents |
| Credits | `/songs/:id/credits` | Contribution ledger, contributor cards, Export button |
| Song Catalog | `/` | 2-col grid, tabs, CogLogo header, Settings icon, FAB, BottomNav |
| Upgrade | `/upgrade` | Free vs Pro comparison cards, "Go Pro" CTA |
| Storage Warning | `/settings/storage` | 85% usage bar, breakdown cards, calm copy |
| Referral Dashboard | `/settings/referral` | Link card, 2×2 stats, "Invite songwriters. Earn monthly." |
| Settings Hub | `/settings` | Account, Upgrade, Storage, Referral, Notifications, Sign out |

**Total: 20 screens complete and navigable.**

### Navigation system
- ✅ BackHeader on every interior screen (44px touch target)
- ✅ BottomNav: Songs / Library / Settings tabs with frosted glass
- ✅ Settings icon in catalog header
- ✅ Deep-links work (direct URL navigation functional)

### Performance
- ✅ Playfair Display + Inter preloaded via Google Fonts with preconnect
- ✅ touch-action: manipulation (eliminates 300ms iOS click delay)
- ✅ -webkit-tap-highlight-color: transparent
- ✅ GPU composite hints on animated elements
- ✅ Lazy-loaded routes (all pages split into separate chunks)
- ✅ prefers-reduced-motion respected throughout
- ✅ apple-mobile-web-app-capable meta (PWA feel)

---

## ⚠️ GAPS — Needed before beta / investor demo

### P0 — Critical for demo

| Gap | What's missing | Effort |
|-----|---------------|--------|
| **Chords page** | `/songs/:id/chords` is in the workspace but routes to nothing | 2h |
| **Song workspace bottom tab nav** | Inside a song, quick-switch between Lyrics/Voice/Chords/Notes/People should be a persistent tab bar, not separate back-navigation | 3h |
| **Real song title in workspace** | "Grace in the Waiting" is hardcoded everywhere — should read from session/context | 1h |
| **Returning user home** | Screen 18 from spec — "Welcome back / Continue Grace in the Waiting" smart resume | 3h |
| **Demo bypass** | A `/demo` route or skip button on login that goes straight to the catalog (for investor demos) | 1h |

### P1 — Important for polish

| Gap | What's missing | Effort |
|-----|---------------|--------|
| **Page transition animation** | `cog-page-enter` class exists in CSS but nothing applies it to route changes yet — need to add to `<Routes>` or use AnimatePresence | 2h |
| **Song workspace quick actions** | "Start anywhere" empty state with 3 quick-action buttons (Write lyric / Record memo / Invite) | 2h |
| **Songwriting Canvas** | The whiteboard — see full plan below | 3–5 weeks |
| **Version history** | `/songs/:id/versions` — snapshot timeline | 2h |
| **Real audio** | MediaRecorder API in VoiceMemoPage and CaptureFirstIdeaPage (Lovable backend task) | Backend |
| **Real auth** | Supabase phone OTP (Lovable task) | Backend |
| **Real songs** | Supabase songs table + CRUD (Lovable task) | Backend |

### P2 — Post-launch

- Profile/avatar page
- Push notifications
- Export (lyrics PDF, credits PDF)
- Offline mode
- iPad-optimized layout

---

## DEMO SCRIPT (5-minute walkthrough)

1. Open `/auth/login` → enter any phone → tap Continue
2. `/auth/verify` → enter any 6 digits → auto-submits → First Intent
3. Tap "Start a song" → name it → "Create song" → lands in Song Workspace
4. Tap "Voice" module → Record New Memo → shows waveform card
5. Tap back → Tap "Lyrics" module → shows chord chips + section editor
6. Tap back → Tap "People" module → invite form → choose Contributor → Send invite → "Invitation Sent!"
7. Tap back → Tap "Activity" module → "What changed since you left" digest
8. Navigate to `←` Songs → Catalog → tap Settings icon → Settings hub
9. Tap "Upgrade to Pro" → Free vs Pro comparison → "Go Pro"
10. Back → "Refer & Earn" → link card + stat grid

**Total time: ~5 minutes. Every screen is real UI, no placeholders.**
