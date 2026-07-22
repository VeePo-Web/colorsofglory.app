# COLORS OF GLORY — THE EMAIL SYSTEM
## Every automated email, its trigger, its copy, and how it grows the app without breaking the calm.

*Owner of copy + strategy: Claude (frontend/UX). Owner of sending/triggers/queue: Lovable. Version 1.0 · 2026-07-05. Implementation status appendix at the end (2026-07-21).*

---

## 0. THE ONE RULE THAT GOVERNS EVERYTHING

Colors of Glory is a **creative sanctuary**, not a growth-hacking funnel. Key Product Decision #9 is law: *no red badge counts, no notification spam, no aggressive upsell banners.* Email is the one channel that leaves the app and lands in someone's actual inbox — so it is the channel most able to violate the sanctuary. It must not.

**The reframe that makes this work:** In most apps, "growth email" and "serving the user" are opposing forces you balance. In Colors of Glory they are the *same force*, because the growth loop **is** the collaboration loop. You don't nag a lonely user to "invite friends for a reward." You help a songwriter get the person they're already writing with into the room. Every genuinely useful collaboration email is also an acquisition event. That is the entire strategy.

**Six operating principles** (every template is checked against these):

1. **One email = one job = one CTA.** Never two asks.
2. **Serve first, spread second.** Value in the first sentence even if they never click.
3. **Calm cadence.** Hard frequency caps (§7). A quiet week is a feature.
4. **Warmth, not hype.** Serif headers, gold accent, plain human sentences. Banned: "unlock," "supercharge," "🔥," "Don't miss out," "Act now," fake urgency, exclamation stacking.
5. **The song is the hero, not the app.** Emails are about *their* song — never about features for their own sake.
6. **Every send respects consent.** Transactional always sends; lifecycle respects the preference center + unsubscribe; quiet hours enforced.

**THE PRIVACY FENCE (hard law, inherited from `digest-recap`):** no email may ever contain a user's creative content — no lyric line, transcript, capture body, scripture note, chord chart, or note text. The allowed vocabulary is: song **title**, actor **display name**, activity **kind**.

---

## 1. INFRASTRUCTURE MAP

| Piece | Reality in the repo |
|---|---|
| Sender: general/lifecycle | `hello@colorsofglory.app` (`COG_SENDERS.primary`) |
| Sender: auth | `security@colorsofglory.app` (`COG_SENDERS.security`) — OTP/reset only |
| Sender: money | `referrals@colorsofglory.app` (`COG_SENDERS.referrals`) |
| Send path | `sendViaResend()` (`_shared/resend.ts`) → Lovable connector gateway → Resend |
| Queue | `notification_queue` (kind, payload, attempts, sent_at, scheduled_for, category, dedupe_key) drained by `notify-referral-event` |
| Identity | `profiles.email/first_name/display_name/timezone`; "no email → skip" guard |
| Tags | `[{app:cog},{category:…},{kind:…}]` on every send |

**Every new email ships as a new `kind`** on `notification_queue` (or a direct `sendViaResend` for instant transactional). Kinds are namespaced: `onboarding.*`, `edu.*`, `collab.*`, `digest.*`, `growth.*`, `retain.*`, `money.*`, `care.*`. Category tag = the namespace root.

---

## 2. THE COMPLETE LIFECYCLE MAP

**T** = transactional (always sends). **L** = lifecycle (respects preferences + caps).

### A · Onboarding & Activation
| # | kind | Trigger | Timing | Type | Sender |
|---|---|---|---|---|---|
| A1 | `onboarding.welcome` | Account created + email captured | Instant | L | hello |
| A2 | `onboarding.first_song_nudge` | 24h after signup, no song | +24h | L | hello |
| A3 | `onboarding.first_capture_win` | First idea/voice captured | Instant/morning | L | hello |
| A4 | `onboarding.room_ready` | ≥1 lyric section AND ≥1 memo | +1h | L | hello |
| A5 | `onboarding.stalled_day3` | Song untouched 72h | +72h | L | hello |

### B · Education (event-gated, never time-blasted)
| # | kind | Gate |
|---|---|---|
| B1 | `edu.hum_capture` | Day 2, no voice memo yet |
| B2 | `edu.lyrics_chords` | Day 4, memos but no lyrics |
| B3 | `edu.listen_path` | ≥3 sections, Listen Path unused |
| B4 | `edu.compare_mode` | 2+ takes of one section |
| B5 | `edu.metronome` | 3+ takes, metronome untouched |
| B6 | `edu.version_history` | 2+ editors, history unopened |
| B7 | `edu.canvas` | 6+ elements |
| B8 | `edu.credits` | 2+ contributors |

*Max one edu email per user per 5 days; permanently suppressed per-feature once used. A power user gets zero education email — correct.*

### C · Collaboration & Transactional
| # | kind | Trigger | Type |
|---|---|---|---|
| C1 | `collab.invite` | Owner invites someone | T |
| C2 | `collab.invite_reminder` | Unaccepted after 3 days (once) | L |
| C3 | `collab.invite_accepted` | Invitee joins | T |
| C4 | `collab.role_set` | Role assigned/changed | T |
| C5 | `collab.suggestion_received` | Line suggestion (batched hourly) | L |
| C6 | `collab.review_queue` | Pending ideas (daily cap) | L |
| C7 | `collab.mention` | @mention (batched hourly) | L |
| C8 | `collab.first_collaborator_owner` | Owner's FIRST accepted invite | L |

### D · Weekly Rhythm
| # | kind | Trigger |
|---|---|---|
| D1 | `digest.what_changed` | Collaborator activity since last visit (weekly, per song) |
| D2 | `digest.your_week` | Solo user with activity (Sun eve) |
| D3 | `growth.invite_nudge` | Weekly invite prompt, §4-gated |

### E · Growth / Referral / Founder
| # | kind | Trigger |
|---|---|---|
| E1 | `growth.referral_explainer` | +1h after 1st invite ever (reward revealed AFTER generosity) |
| E2 | `growth.referral_progress` | A referred person activates |
| E3 | `growth.reward_*` | reward/payout events — **LIVE** |
| E4 | `growth.founder_invite` | Founder code granted |
| E5 | `growth.milestone` | 3 collaborators / 5 songs |

### F · Retention
F1 `retain.gentle_return` (+14d, unfinished song) · F2 `retain.someone_waiting` (collaborator waiting — highest-intent) · F3 `retain.winback` (+45d, once) · F4 `retain.song_anniversary` (annual).

### G · Monetization (calm, honest, never dark)
G1 `money.second_song_upgrade` · G2 `money.storage_warning` (80%) · G3 `money.storage_full` (T) · G4 `money.receipt` (T) · G5 `money.subscription_confirmed` (T) · G6 `money.payment_failed` dunning ×3 (T) · G7 `money.renewal_reminder` (T) · G8 `money.canceled_confirm` (T).

### H · Care / Faith layer
H1 `care.finished_song` · H2 `care.encouragement` (monthly max) · H3 `care.year_in_song` (annual).

**Total: ~45 automated emails across 8 programs.** A healthy engaged user receives ~1–3 emails/week, never more.

---

## 3. THE BRAND SHELL

One shared shell (`renderEmail()` in `_shared/email.ts`): cream `#EDE7DA` page, `#FAF7F2` card, 16px radius, gold `#B8953A` exactly twice (wordmark + single CTA), serif (Georgia/Playfair) for the ONE emotional headline, humanist sans body, hidden preheader, footer with "Every part of your song, in one room.", preference + category-unsubscribe links (L) or "This is a service message" (T). Inline styles only; `color-scheme` set; auto-generated plain-text alternative on every send; 600px max, mobile-first.

---

## 4. THE GROWTH ENGINE (spread without spam)

1. **The invite email (C1) is the primary acquisition surface** — most invited collaborators are not yet users. It gets the most craft; the `/invite/:token` landing lets them preview before signup.
2. **The weekly invite nudge (D3) is hard-gated:** active solo song (edited ≤10d, ≥3 elements) AND 0–1 collaborators AND no invite sent in 14d AND not dismissed twice (2 dismissals → 60-day suppression). If any gate fails, silence.
3. **Rewards revealed AFTER generosity (E1):** never lead with "Get $X!" — one hour after the user's first self-chosen invite, a warm thank-you explains the reward. Reciprocity after generosity beats upfront bribery, ethically and in conversion.

We optimize invite-email **open→account-create**, never "emails sent."

---

## 5. THE TEMPLATES (production copy)

Merge fields null-safe everywhere: `{{first_name}}` → "there" fallback; never "Hi ,".

### A1 · onboarding.welcome
- **Subject:** Welcome to Colors of Glory / Your first song is waiting for you / {{first_name}}, let's start your first song
- **Preview:** One room for the lyrics, the voice memos, the chords — everything for one song, together.
- **Body:** **Welcome, {{first_name}}.** *(serif)* — the "song lives in five places" story → "Colors of Glory gives every song one private room… Nothing scatters. Nothing gets lost. Your first song is free, and it's ready now. Let's name it."
- **CTA:** Start your first song → `/song/new`

### A2 · onboarding.first_song_nudge
- **Subject:** The hardest part is just naming it / What's the song you can't stop humming?
- **Body:** **You don't need a finished song to begin.** *(serif)* — "four words and a melody hummed into a phone at a red light… Give it a working title — even 'Untitled Sunday'."
- **CTA:** Open your first room → `/song/new` · once, only if still no song.

### A3–A5, B1–B8, D1–D3, E1–E5, F1–F4, G1–G8, H1–H3
Full copy retained from spec v1.0 (see git history of this file / the product doc). Highlights: B1 hum-capture is the flagship education email ("Sing it before you lose it… Hold one button. Hum. Done."); D1 is Product Vision 08 as email ("Nothing needs you urgently"); D3 is the §4-gated invite prompt ("Who are you writing {{song_title}} for?"); H1 celebrates a finished song.

### C1 · collab.invite — THE most important growth email
- **Subject A:** {{inviter_name}} invited you into a song · **B:** {{inviter_name}} wants to write "{{song_title}}" with you
- **Preview:** {{inviter_name}} started "{{song_title}}" and saved a place for you in the room.
- **Body:** **{{inviter_name}} saved you a place.** *(serif)* — "They're working on a song called **{{song_title}}**, and they want you in the room — as a **{{role}}**. Inside, you'll find everything for this one song in a single place… You can {{role_capability_line}}. {{optional_personal_note}} The room's ready when you are."
- **role_capability_line:** collaborator → "add lyrics, record ideas, and leave notes"; viewer → "listen and read along."
- **CTA:** Step into the room → `/invite/{{token}}`
- Footer: "You received this because {{inviter_name}} invited you to a song." One-time per invite.

### C2 · collab.invite_reminder
- **Subject:** {{song_title}} is still holding a place for you · exactly once, +3d, only if still pending. Then silent.

### C3 · collab.invite_accepted (to inviter)
- **Subject:** {{invitee_name}} is in the room · **Body:** "{{invitee_name}} just stepped into **{{song_title}}**. The song isn't yours alone anymore — in the best way." **CTA:** See who's in the room.

---

## 6. VOICE

Subjects sound like: "What changed in {{song_title}} this week" · "The melody in your head — hum it, keep it" · "{{inviter_name}} saved you a place" · "You finished it."
Never: "🔥 50% OFF — 24 HOURS ONLY!!" · "we miss you 😢" · "supercharge" · decorative emoji.
**Banned words:** unlock, supercharge, leverage, seamless, revolutionary, game-changer, hustle, grind, crush it, don't miss out, act now, limited time. **Preferred:** room, keep, shape, capture, remember, together, ready, safe, waiting, hum, voice, line.

---

## 7. SEND GOVERNANCE (non-negotiable)

- **Global caps:** max **3 L-emails / rolling 7 days**, max **1 L-email / 24h** per user. T-mail exempt. Contention priority: `collab.*` > `digest.what_changed` > `edu.*` > `growth.invite_nudge` > `retain.*` > rest.
- **Batching:** C5/C6/C7 collapse (60-min windows); never one email per event.
- **Quiet hours:** no L-email 9pm–7am recipient-local (profiles.timezone; sensible default if unknown). Night triggers defer to morning.
- **Preference center** (`/settings/notifications`): per-category toggles; transactional/security cannot be disabled.
- **Unsubscribe:** category + global "pause all non-essential," one-click (List-Unsubscribe, RFC 8058), honored via a suppression set keyed (user, category).
- **Suppression & health:** hard bounce/complaint → suppress all lifecycle; 2 nudge dismissals → 60-day type suppression; no email on profile → skip + log; check global flag before every L-send.
- **Deliverability:** SPF/DKIM/DMARC on all three senders; `hello@` for lifecycle and `security@` isolated; complaint rate < 0.1%; plain-text alternative on every send.

---

## 8. IMPLEMENTATION NOTES (Lovable + Claude)

1. Shell helper `renderEmail(...)` in `_shared/email.ts`; every template is a thin copy function. Reward emails re-skinned through it.
2. New namespaced `kind`s on `notification_queue`; instant transactional may call `sendViaResend` directly.
3. Triggers: instant T → edge fn on the mutation; event-gated B/E → nightly evaluator enqueuing ≤1 top-priority eligible email; weekly D → scheduled job (per-user local Sunday evening).
4. Null-safe merge everywhere.
5. **`canSend(userId, kind)` is the most important logic** — one gate every enqueue/drain passes through: rolling counts, quiet hours, suppression, dismissals.
6. North-star funnels: (a) C1 open → account-create, (b) D3 click → invite-sent, (c) A1 click → first-song-created.
7. Test matrix: Gmail/Apple/Outlook render, dark-mode legible, null merges, text fallback, valid unsubscribe, 390px.

## 9. BUILD ORDER
1 shell + re-skin rewards → 2 C1/C3/C2 → 3 A1/A2 → 4 D1 digest → 5 B1/B2 → 6 D3+E1 → 7 §7 governance (before B/D/E scale) → 8 G billing → 9 F+H → 10 remaining B.

---

## IMPLEMENTATION STATUS — 2026-07-21 (Claude)

**Shipped (Steps 1–3 + A1/A2 spine):**
- `_shared/email.ts` — `renderEmail()` COG shell (+auto plain-text) + template functions: reward re-skins (E3), C1 invite, C2 reminder, C3 accepted, A1 welcome, A2 first-song nudge.
- Migration `notification_queue + scheduled_for/category/dedupe_key` (+ partial unique dedupe index) + `email_suppressions` table (RLS deny-by-default, user reads own).
- `_shared/emailGovernance.ts` — `canSend()`: suppression (global + category), rolling caps (1/24h, 3/7d L-mail from queue history), quiet hours (21–07 recipient-local via `profiles.timezone`, defer-to-morning).
- `notify-referral-event` generalized into the governed multi-category drain: scheduled_for-aware, governance-gated for L-kinds, `payload.to_email` support (non-user recipients), pending-check for invite reminders, unknown kinds parked (never wedge the queue), reward bodies re-skinned.
- `song-invite-create` now SENDS C1 (T, instant, hello@) when `invited_email` present + enqueues the C2 reminder (+3d, deduped per invite, auto-skips if accepted). `song-invite-accept` sends C3 to the inviter.
- `onboarding-set-step` enqueues A1 (instant) + A2 (+24h; drain re-checks "still no song") once ever per user (dedupe keys).

**Shipped 2026-07-22 (Steps 4–5 + C8/E1):**
- `email-lifecycle-evaluator` — the scheduled brain (cron it daily; it only
  ENQUEUES, deduped; the governed drain owns delivery). Passes: **D1**
  per-member digests for multi-member songs with other-actor activity since
  that member's `song_notification_prefs.last_seen_at` (weekly ISO-week
  dedupe; work-budgeted); **B1/B2** education for 2–21-day-old accounts
  (once ever; one education thread at a time).
- D1 renders deterministic fenced bullet lines (same `song_activity`
  vocabulary as `digest-recap`: kind + actor name + count — the LLM
  paragraph is deliberately NOT used for email: the drain has no user JWT
  and deterministic beats generative in an inbox). The digest **evaporates
  at send time if the user visited the room after it was queued.**
- B1/B2 re-check their gates at send time (recorded a memo → hum email
  evaporates; wrote lyrics → lyrics email evaporates). A power user gets
  zero education email — correct.
- **C8** first-collaborator moment enqueued on the inviter's first-ever
  accepted invite (+30 min, once ever) · **E1** referral explainer enqueued
  +1h after the first invite ever (once ever, referrals@).

**Not yet built (next slices, in §9 order):** D2 solo digest + D3 invite
nudge (needs the §4 gates + dismissal tracking), remaining A (A3/A4/A5) and
B (B3–B8) programs, E2/E4/E5, G billing set (on payments-webhook), F/H
programs, preference-center wiring to `email_suppressions`, List-Unsubscribe
headers + one-click endpoint, per-kind A/B subjects.
**Ops ask (Lovable):** schedule `email-lifecycle-evaluator` daily (morning
UTC) alongside the existing `notify-referral-event` drain cron (drain every
5–15 min).
