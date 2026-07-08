# COG Route Map — canonical

> This is the single source of truth for the app's route tree. It is generated
> from the real `src/App.tsx` + `src/routes/*` fragments, and **supersedes
> CLAUDE.md §4** (which describes an older `/song/:id/...` singular tree that no
> longer matches the shipped app).

The app is **capture-first** and **plural** (`/songs/:id`). Mic-first capture is
both the app landing (`/`) and a song's default landing (`/songs/:id`); the
workspace hub is one tap away at `/songs/:id/room`.

## Composition

Routing lives in five lazy-loaded fragments composed inside `<Routes>` in
`src/App.tsx`:

- `src/routes/authRoutes.tsx` — auth, invite/join, returning-home
- `src/routes/onboardingRoutes.tsx` — first-run onboarding
- `src/routes/songRoutes.tsx` — capture-first song surfaces
- `src/routes/settingsRoutes.tsx` — settings + pricing/checkout
- `src/routes/AdminRoutes.tsx` — internal admin (13 routes)

Plus, inline in App.tsx: `/terms`, `/privacy`, and the `*` branded 404.

## Guards

- **RequireAuth** (`src/components/auth/RequireAuth.tsx`) — waits during
  `loading` (renders the shared `BrandedSkeleton`), bounces `anon` → `/auth/login`
  and stashes the attempted path in `sessionStorage["cog:return-to"]` for
  post-login resume. RLS is the real trust boundary; this just keeps anon users
  off broken/empty screens.
- **RequireAdmin** (`src/components/admin/RequireAdmin.tsx`) — `isCurrentUserAdmin()`
  + noindex meta. Wraps every `/admin/*` route.

## Route → guard matrix

### Public (no guard — by design)
| Path | Component |
|---|---|
| `/auth` → `/auth/login` | Navigate |
| `/auth/login` | PhoneLoginPage |
| `/auth/phone` → `/auth/login` | Navigate |
| `/auth/phone/verify` | CodeVerifyPage |
| `/auth/email` | EmailAuthPage |
| `/auth/forgot-password` | ForgotPasswordPage |
| `/auth/reset`, `/auth/reset-password` | ResetPasswordPage |
| `/onboarding` → `/auth/login` | Navigate |
| `/onboarding/intent` | FirstIntentPage |
| `/onboarding/start-song` | StartFirstSongPage |
| `/onboarding/founder-code` | FounderCodePage |
| `/onboarding/earn` | EarnPage |
| `/invite/:token` → `/join/:token` | InviteTokenRedirect |
| `/join`, `/join/:token` | JoinEntryPage / InviteJoinPage |
| `/invite/{welcome,verify,name,team}` | Invite* pages |
| `/upgrade`, `/pricing` | PricingUpgradePage |
| `/checkout/success` | CheckoutSuccessPage |
| `/r/:code` | ReferralRedirectPage |
| `/upgrade-old` | UpgradePage (legacy) |
| `/terms`, `/privacy` | Legal pages |
| `/albums/:albumId/practice` | AlbumPracticeExperience — see note ① |
| `*` | NotFound (branded 404) |

### RequireAuth (protected app surfaces)
| Path | Component |
|---|---|
| `/home` | ReturningHomePage |
| `/`, `/capture` | CapturePage |
| `/songs` | SongCatalogPage |
| `/songs/:id`, `/songs/:id/capture` | CapturePage |
| `/songs/:id/room` | SongWorkspacePage |
| `/songs/:id/brainstorm` | BrainstormPage |
| `/songs/:id/capture-onboarding` | CaptureFirstIdeaPage |
| `/songs/:id/voice-added` | VoiceMemoAddedPage |
| `/songs/:id/lyrics`, `/chords`, `/sheet` | SongSheetPage (C3) |
| `/songs/:id/canvas` | SongCanvasPage |
| `/songs/:id/practice` | PracticePlayerPage |
| `/songs/:id/voice` | VoiceMemosPage (C4) |
| `/songs/:id/notes` | NotesPage (C5) |
| `/songs/:id/activity` | ActivityPage (E2) |
| `/songs/:id/credits` | CreditsPage |
| `/songs/:id/versions` | VersionHistoryPage (E3) |
| `/songs/:id/memory` | SongMemoryPage |
| `/memory` | MemoryPage (Feature 33) |
| `/settings` | SettingsPage |
| `/settings/{billing,storage,referral}` | Billing/Storage/Referral |

### RequireAdmin
All `/admin/*` (13 routes) — see `src/routes/AdminRoutes.tsx`.

### Panel → canvas redirect
| `/songs/:id/people` | → `/songs/:id/canvas?layer=people` |

## Notes / open items

① **`/albums/:albumId/practice` is intentionally left unguarded** pending a
product decision on whether album-practice is a public share surface. Every
other app-content surface is guarded; if albums are always private, wrap it in
RequireAuth for consistency.

② **Guard closure (this pass):** `/songs/:id/{canvas,practice,capture-onboarding,
voice-added}`, all four `/settings*`, and `/home` were previously unguarded and
are now behind RequireAuth.

③ **Deep-link resume:** RequireAuth stashes `cog:return-to`; `routeAfterAuth`
(`src/lib/auth/postAuthRoute.ts`) consumes it after login, so an anon deep-link
to a guarded page resumes there after auth (survives the phone-OTP page hop that
drops router `location.state`).

④ **Onboarding routing:** `routeAfterAuth` maps every `onboarding_step` via a
typed exhaustive table — `referral_program_seen` / `founder_code_seen` now land
on their own screens instead of being swallowed into a `/songs/:firstSongId`
branch that broke when no song existed yet.
