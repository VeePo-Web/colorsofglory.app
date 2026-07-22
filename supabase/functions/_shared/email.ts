// The COLORS OF GLORY email shell + template library.
// Spec of record: docs/email/COG-EMAIL-SYSTEM.md (§3 shell, §5 copy, §6 voice).
//
// One shell, every email: cream page, warm card, gold exactly twice (wordmark
// + the single CTA), serif for the ONE emotional headline, humanist sans body,
// auto-generated plain-text alternative. Templates are thin copy functions.
//
// THE PRIVACY FENCE (hard law): no email ever contains creative content — no
// lyric line, transcript, capture body, scripture, chord chart, or note text.
// Allowed vocabulary: song TITLE, actor DISPLAY NAME, activity KIND.

export const APP_URL = Deno.env.get("COG_APP_URL") ?? "https://colorsofglory.app";

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** "Hi ," is a failure state — null-safe first names everywhere (§5). */
export function safeFirstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n.length > 0 ? n : "there";
}

const SERIF = "Georgia,'Playfair Display',serif";
const SANS = "'Helvetica Neue',Arial,sans-serif";

export interface RenderEmailArgs {
  /** Hidden preview text. Required — inbox real estate matters. */
  preheader: string;
  /** The one serif emotional headline. */
  headline: string;
  /** Body paragraphs, already-escaped HTML (use p() / quote() helpers). */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Namespace root: onboarding | edu | collab | digest | growth | retain | money | care */
  category: string;
  /** Human label for the category-unsubscribe line, e.g. "song activity emails". */
  categoryLabel?: string;
  /**
   * Transactional mail replaces the unsubscribe line with a service note.
   * Optionally override that note (e.g. the invite's "because X invited you").
   */
  transactional?: boolean;
  transactionalNote?: string;
}

/** A body paragraph in the house sans. Escapes its inputs via template use. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`;
}

/** The inviter's optional personal note, quoted — rendered only when present. */
export function quote(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #B8953A;background:rgba(184,149,58,0.07);border-radius:0 10px 10px 0;font-style:italic;color:#6B6459;">&ldquo;${escapeHtml(t)}&rdquo;</p>`;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Render the one COG shell. Returns { html, text } — pass BOTH to
 * sendViaResend (a plain-text alternative on every send is deliverability
 * hygiene, §7).
 */
/**
 * Lifecycle footers carry this placeholder; the DRAIN replaces it with the
 * recipient's tokenized one-click unsubscribe URL (lifecycle mail only ever
 * leaves through the drain, so it is always resolved before sending).
 */
export const UNSUB_URL_PLACEHOLDER = "{{UNSUB_URL}}";

export function renderEmail(args: RenderEmailArgs): { html: string; text: string } {
  const prefsUrl = `${APP_URL}/settings/notifications`;
  const footerLine = args.transactional
    ? escapeHtml(args.transactionalNote ?? "This is a service message about your account or a song you're part of.")
    : `<a href="${prefsUrl}" style="color:#6B6459;">Email preferences</a> · <a href="${UNSUB_URL_PLACEHOLDER}" style="color:#6B6459;">Unsubscribe from ${escapeHtml(args.categoryLabel ?? "these emails")}</a>`;

  // Bulletproof button: VML rect for Outlook (which ignores border-radius +
  // padding on <a>), the styled anchor for everyone else.
  const cta = args.ctaLabel && args.ctaUrl
    ? `<tr><td style="padding:12px 32px 32px;text-align:center;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${args.ctaUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="29%" fillcolor="#B8953A" stroke="f">
          <w:anchorlock/>
          <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(args.ctaLabel)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${args.ctaUrl}" style="display:inline-block;background:#B8953A;color:#FFFFFF;text-decoration:none;font-family:${SANS};font-weight:600;font-size:16px;padding:15px 34px;border-radius:14px;">${escapeHtml(args.ctaLabel)}</a>
        <!--<![endif]-->
      </td></tr>`
    : `<tr><td style="padding:0 32px 28px;"></td></tr>`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#EDE7DA;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE7DA;">${escapeHtml(args.preheader)}${"&nbsp;&zwnj;".repeat(30)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DA;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FAF7F2;border-radius:16px;border:1px solid rgba(28,26,23,0.10);overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;text-align:center;background:radial-gradient(ellipse 70% 100% at 50% 0%,rgba(184,149,58,0.14),transparent 70%);">
          <span style="font-family:${SERIF};font-size:15px;letter-spacing:0.14em;text-transform:uppercase;color:#B8953A;">Colors of Glory</span>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;font-family:${SANS};font-size:16px;line-height:1.62;color:#1C1A17;">
          <p style="margin:0 0 16px;font-family:${SERIF};font-size:22px;line-height:1.35;color:#1C1A17;"><strong>${escapeHtml(args.headline)}</strong></p>
          ${args.bodyHtml}
        </td></tr>
        ${cta}
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:22px 32px;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:#A09689;">
          Every part of your song, in one room.<br>
          ${footerLine}<br>
          Colors of Glory · Made for songwriters and the people they create with.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    args.headline,
    "",
    stripTags(args.bodyHtml),
    args.ctaLabel && args.ctaUrl ? `\n${args.ctaLabel}: ${args.ctaUrl}` : "",
    "",
    "Every part of your song, in one room.",
    args.transactional
      ? (args.transactionalNote ?? "This is a service message about your account or a song you're part of.")
      : `Email preferences: ${prefsUrl}\nUnsubscribe: ${UNSUB_URL_PLACEHOLDER}`,
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { html, text };
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATES — thin copy functions per docs/email/COG-EMAIL-SYSTEM.md §5.
// Each returns { subject, html, text }.
// ─────────────────────────────────────────────────────────────────────────

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

const ROLE_CAPABILITY: Record<string, string> = {
  collaborator: "add lyrics, record ideas, and leave notes",
  viewer: "listen and read along",
};

/** C1 · collab.invite — the most important growth email in the system. */
export function inviteEmail(args: {
  inviterName: string;
  songTitle: string;
  role: string;
  personalNote?: string | null;
  token: string;
}): RenderedTemplate {
  const inviter = escapeHtml(args.inviterName);
  const title = escapeHtml(args.songTitle);
  const capability = ROLE_CAPABILITY[args.role] ?? ROLE_CAPABILITY.collaborator;
  const roleLabel = args.role === "viewer" ? "listener" : "collaborator";
  const { html, text } = renderEmail({
    preheader: `${args.inviterName} started "${args.songTitle}" and saved a place for you in the room.`,
    headline: `${args.inviterName} saved you a place.`,
    bodyHtml:
      p(`They're working on a song called <strong>${title}</strong>, and they want you in the room — as a <strong>${escapeHtml(roleLabel)}</strong>.`) +
      p(`Inside, you'll find everything for this one song in a single place: the voice memos, the lyrics taking shape, the chords, the notes. You can ${capability}. No scattered files, no long text threads to catch up on — just the song, and the people writing it.`) +
      quote(args.personalNote) +
      p(`The room's ready when you are.`),
    ctaLabel: "Step into the room",
    ctaUrl: `${APP_URL}/invite/${args.token}`,
    category: "collab",
    transactional: true,
    transactionalNote: `You received this because ${inviter} invited you to a song.`,
  });
  return { subject: `${args.inviterName} invited you into a song`, html, text };
}

/** C2 · collab.invite_reminder — exactly once, +3 days, only if still pending. */
export function inviteReminderEmail(args: {
  inviterName: string;
  songTitle: string;
  token: string;
}): RenderedTemplate {
  const title = escapeHtml(args.songTitle);
  const { html, text } = renderEmail({
    preheader: `No rush — the room ${args.inviterName} opened for you is still there.`,
    headline: `${args.songTitle} is still holding a place for you.`,
    bodyHtml:
      p(`A few days ago, ${escapeHtml(args.inviterName)} invited you into their song <strong>${title}</strong>. The room is still open — the voice memos, the lyrics, the chords, all in one place, waiting for your ear.`) +
      p(`No pressure at all. Step in whenever you're ready.`),
    ctaLabel: "Step into the room",
    ctaUrl: `${APP_URL}/invite/${args.token}`,
    category: "collab",
    // The recipient may have no account (no unsubscribe token to give), and
    // this is structurally the ONLY reminder — an honest service note beats
    // a dead unsubscribe link.
    transactional: true,
    transactionalNote: `You received this because ${escapeHtml(args.inviterName)} invited you to a song. This is the only reminder.`,
  });
  return { subject: `${args.songTitle} is still holding a place for you`, html, text };
}

/** C3 · collab.invite_accepted — to the inviter, instant. */
export function inviteAcceptedEmail(args: {
  inviteeName: string;
  songTitle: string;
  songId: string;
  role: string;
}): RenderedTemplate {
  const invitee = escapeHtml(args.inviteeName);
  const title = escapeHtml(args.songTitle);
  const capability = ROLE_CAPABILITY[args.role] ?? ROLE_CAPABILITY.collaborator;
  const { html, text } = renderEmail({
    preheader: `${args.inviteeName} just stepped into ${args.songTitle}.`,
    headline: `${args.inviteeName} is in the room.`,
    bodyHtml:
      p(`${invitee} just stepped into <strong>${title}</strong>. The song isn't yours alone anymore — in the best way.`) +
      p(`They can ${capability}, and everything they add will show up in your activity feed. Every contribution gets remembered in the credits.`),
    ctaLabel: "See who's in the room",
    ctaUrl: `${APP_URL}/songs/${args.songId}/people`,
    category: "collab",
    transactional: true,
  });
  return { subject: `${args.inviteeName} is in the room`, html, text };
}

/** A1 · onboarding.welcome */
export function welcomeEmail(args: { firstName: string | null | undefined }): RenderedTemplate {
  const name = safeFirstName(args.firstName);
  const { html, text } = renderEmail({
    preheader: "One room for the lyrics, the voice memos, the chords — everything for one song, together.",
    headline: `Welcome, ${name}.`,
    bodyHtml:
      p(`You know that feeling when a song lives in five places at once? The melody's a voice memo you can't find, the lyrics are in your Notes app, the chords are on a napkin, and your co-writer's best idea is buried in a text thread.`) +
      p(`Colors of Glory gives every song <strong>one private room</strong> — where the voice memos, lyrics, chords, and the people you're writing with all stay in one place. Nothing scatters. Nothing gets lost.`) +
      p(`Your first song is free, and it's ready now. Let's name it.`),
    ctaLabel: "Start your first song",
    ctaUrl: `${APP_URL}/`,
    category: "onboarding",
    categoryLabel: "getting-started emails",
  });
  return { subject: "Your first song is waiting for you", html, text };
}

/** A2 · onboarding.first_song_nudge — only if still no song at send time. */
export function firstSongNudgeEmail(): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "You don't need finished lyrics. A title and a hum is a whole beginning.",
    headline: "You don't need a finished song to begin.",
    bodyHtml:
      p(`Some of the best songs started as four words and a melody hummed into a phone at a red light. That's enough to open a room.`) +
      p(`Give it a working title — even &ldquo;Untitled Sunday&rdquo; — and capture the first thing you've got. You can shape it later.`),
    ctaLabel: "Open your first room",
    ctaUrl: `${APP_URL}/`,
    category: "onboarding",
    categoryLabel: "getting-started emails",
  });
  return { subject: "The hardest part is just naming it", html, text };
}

/**
 * Server-side humanizer for activity kinds — the same fenced vocabulary as
 * the in-app recap (kind + actor name + count; never content).
 */
const KIND_PHRASES: Record<string, { one: string; many: (n: number) => string }> = {
  take_committed: { one: "saved a take to the canvas", many: (n) => `saved ${n} takes to the canvas` },
  capture_created: { one: "captured a new idea", many: (n) => `captured ${n} new ideas` },
  capture_promoted: { one: "promoted an idea", many: (n) => `promoted ${n} ideas` },
  memo_uploaded: { one: "added a voice memo", many: (n) => `added ${n} voice memos` },
  invite_accepted: { one: "joined the song", many: () => "joined the song" },
  member_left: { one: "left the song", many: () => "left the song" },
  owner_transferred: { one: "became the owner", many: () => "became the owner" },
  card_moved: { one: "rearranged an idea", many: (n) => `rearranged ${n} ideas` },
  card_linked: { one: "connected two ideas", many: (n) => `connected ${n} ideas` },
  card_grouped: { one: "grouped ideas together", many: () => "grouped ideas together" },
  card_section_set: { one: "tagged an idea with a section", many: (n) => `tagged ${n} ideas with sections` },
  card_promoted_final: { one: "moved an idea into Final", many: (n) => `moved ${n} ideas into Final` },
  card_deleted: { one: "removed an idea", many: (n) => `removed ${n} ideas` },
  idea_amened: { one: "left an amen on an idea", many: (n) => `left ${n} amens` },
};

export function humanizeActivityKind(kind: string, count: number): string {
  const p = KIND_PHRASES[kind];
  if (!p) return count > 1 ? `made ${count} changes` : "made a change";
  return count > 1 ? p.many(count) : p.one;
}

/** D1 · digest.what_changed — Product Vision 08 as email. `lines` are
 * pre-humanized, fence-safe strings ("Sarah added 2 voice memos"). */
export function whatChangedEmail(args: {
  songTitle: string;
  songId: string;
  lines: string[];
}): RenderedTemplate {
  const title = escapeHtml(args.songTitle);
  const shown = args.lines.slice(0, 5);
  const extra = args.lines.length - shown.length;
  const list =
    `<ul style="margin:0 0 16px;padding-left:20px;">` +
    shown.map((l) => `<li style="margin:0 0 6px;">${escapeHtml(l)}</li>`).join("") +
    (extra > 0 ? `<li style="margin:0 0 6px;color:#6B6459;">+${extra} more</li>` : "") +
    `</ul>`;
  const { html, text } = renderEmail({
    preheader: "Here's the calm recap — nothing needs you urgently.",
    headline: `Here's what happened in ${args.songTitle}.`,
    bodyHtml:
      p(`While you were away:`) +
      list +
      p(`Nothing needs you urgently. It's all here whenever you're ready.`),
    ctaLabel: "See what changed",
    ctaUrl: `${APP_URL}/songs/${args.songId}/activity`,
    category: "digest",
    categoryLabel: "weekly recaps",
  });
  return { subject: `What changed in ${args.songTitle} this week`, html, text };
}

/** B1 · edu.hum_capture — the flagship education email. */
export function humCaptureEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "The fastest way to save a melody isn't writing it down. It's humming it.",
    headline: "Sing it before you lose it.",
    bodyHtml:
      p(`Melodies are slippery. The one that felt perfect in the shower is often gone by the time you find a pen. So don't reach for a pen.`) +
      p(`In <strong>${escapeHtml(args.songTitle)}</strong>, press and <strong>hold the record button</strong> and just hum, sing, or beatbox the idea — no setup, no perfect take. Let go, and it's saved as a voice memo with a waveform you can play back anytime. Record another take right over it if the next one's better.`) +
      p(`That half-formed melody in your head right now? Thirty seconds. Go catch it.`),
    ctaLabel: "Hum your first idea",
    ctaUrl: `${APP_URL}/songs/${args.songId}/voice`,
    category: "edu",
    categoryLabel: "tips & feature guides",
  });
  return { subject: "The melody in your head — hum it, keep it", html, text };
}

/** B2 · edu.lyrics_chords */
export function lyricsChordsEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "Chord chips sit right above the line they belong to — no more guessing where the G goes.",
    headline: "Chords over the words, right where they belong.",
    bodyHtml:
      p(`You've been catching melodies for <strong>${escapeHtml(args.songTitle)}</strong> — now give them words to live with.`) +
      p(`Type a line, drop chord chips (C, G, Am) right above the exact word they change on, and keep the voice memo of that section beside it so the melody and the words stay together. The way you'd actually teach it to your team on a Sunday.`),
    ctaLabel: "Write your first verse",
    ctaUrl: `${APP_URL}/songs/${args.songId}/lyrics`,
    category: "edu",
    categoryLabel: "tips & feature guides",
  });
  return { subject: "Turn that memo into lyrics and chords", html, text };
}

/** C8 · collab.first_collaborator_owner — a one-time moment. */
export function firstCollaboratorEmail(args: {
  inviteeName: string;
  songTitle: string;
  songId: string;
}): RenderedTemplate {
  const invitee = escapeHtml(args.inviteeName);
  const { html, text } = renderEmail({
    preheader: "A song was never meant to live alone in one person's phone.",
    headline: "Your song just became a conversation.",
    bodyHtml:
      p(`${invitee} is the first person you've brought into a song here — and that's the whole heart of this thing. A song was never meant to live alone in one person's phone. It's meant to be passed back and forth until it's better than either of you could've made it apart.`) +
      p(`Everything ${invitee} adds will show up in your activity feed, and every contribution gets remembered in the credits. Go make something together.`),
    ctaLabel: `Open ${args.songTitle}`,
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "collab",
    categoryLabel: "song activity emails",
  });
  return { subject: "This is the moment Colors of Glory was built for", html, text };
}

/** E1 · growth.referral_explainer — the reward revealed AFTER generosity. */
export function referralExplainerEmail(): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "You invited someone because you wanted to. Here's what we do in return.",
    headline: "You didn't do it for a reward. That's exactly why we give one.",
    bodyHtml:
      p(`You invited someone into a song because you wanted to write with them — not for points. We love that. So here's how Colors of Glory quietly says thank you:`) +
      p(`When someone you invite makes this their home and starts a plan of their own, a small thank-you reward is set aside for you. It's our way of honoring the people who make this a community instead of an app.`) +
      p(`You never have to think about it. Keep inviting the people your songs are meant for, and the rest takes care of itself.`),
    ctaLabel: "See your referrals",
    ctaUrl: `${APP_URL}/settings/referral`,
    category: "growth",
    categoryLabel: "referral emails",
  });
  return { subject: "A small thank-you for bringing someone in", html, text };
}

/** A3 · onboarding.first_capture_win — reinforce the first aha. */
export function firstCaptureWinEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "It's captured, timestamped, and it isn't going anywhere.",
    headline: "Caught it.",
    bodyHtml:
      p(`Your first idea for <strong>${escapeHtml(args.songTitle)}</strong> is saved — waveform, timestamp, and all. It'll be right there every time you open the room, and so will everything you add next.`) +
      p(`Here's the quiet magic: you never have to remember where you put it again.`),
    ctaLabel: "Add the next piece",
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "onboarding",
    categoryLabel: "getting-started emails",
  });
  return { subject: "That idea is safe now", html, text };
}

/** A4 · onboarding.room_ready — lyrics + voice now live together. */
export function roomReadyEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "Lyrics and voice, in one place — this is the whole point.",
    headline: "Your song is starting to feel like a room.",
    bodyHtml:
      p(`<strong>${escapeHtml(args.songTitle)}</strong> now has words AND a voice — the two halves of a song, finally living in the same place. No more melody in one app and lyrics in another.`) +
      p(`Everything for this song stays connected here. Keep adding; nothing scatters.`),
    ctaLabel: "See it come together",
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "onboarding",
    categoryLabel: "getting-started emails",
  });
  return { subject: "Your song is starting to feel like a room", html, text };
}

/** A5 · onboarding.stalled_day3 — gentle, zero guilt. */
export function stalledSongEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "No rush. It'll keep.",
    headline: `${args.songTitle} is still waiting for you.`,
    bodyHtml:
      p(`No rush — it'll keep. Every memo and every line is exactly where you left it.`) +
      p(`When you've got two minutes, add one line or hum one bar. Small additions are how songs get finished.`),
    ctaLabel: "Pick it back up",
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "onboarding",
    categoryLabel: "getting-started emails",
  });
  return { subject: `${args.songTitle} is still waiting for you`, html, text };
}

/** D2 · digest.your_week — the solo writer's gentle reflection. */
export function yourWeekEmail(args: {
  songTitle: string;
  songId: string;
  ideaCount: number;
}): RenderedTemplate {
  const n = args.ideaCount;
  const { html, text } = renderEmail({
    preheader: "A quiet look at what you built this week.",
    headline: `Your week in ${args.songTitle}.`,
    bodyHtml:
      p(`You added ${n === 1 ? "an idea" : `${n} ideas`} to <strong>${escapeHtml(args.songTitle)}</strong> this week. It's coming along — not by force, just by showing up.`) +
      p(`The room's ready whenever the next piece arrives.`),
    ctaLabel: "Keep going",
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "digest",
    categoryLabel: "weekly recaps",
  });
  return { subject: `Your week in ${args.songTitle}`, html, text };
}

/** D3 · growth.invite_nudge — the §4-gated weekly invite prompt. */
export function inviteNudgeEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const title = escapeHtml(args.songTitle);
  const { html, text } = renderEmail({
    preheader: "A worship leader, a co-writer, the friend who always knows the right line — the room has space.",
    headline: "Some songs want company.",
    bodyHtml:
      p(`<strong>${title}</strong> is far enough along that another set of ears might be exactly what it needs — a co-writer, the worship leader who'll actually sing it, the friend who always finds the line you couldn't.`) +
      p(`Bringing someone in takes ten seconds. They'll see everything in one room and can jump in wherever they're useful. And every part they touch gets remembered in the credits.`) +
      p(`No pressure at all — just an open door if there's someone in mind.`),
    ctaLabel: "Invite someone in",
    ctaUrl: `${APP_URL}/songs/${args.songId}/people`,
    category: "growth",
    categoryLabel: "invite suggestions",
  });
  return { subject: `Who are you writing ${args.songTitle} for?`, html, text };
}

/** F1 · retain.gentle_return — 14 days away, zero guilt. */
export function gentleReturnEmail(args: { songTitle: string; songId: string }): RenderedTemplate {
  const { html, text } = renderEmail({
    preheader: "Every memo, every line — exactly as you left it.",
    headline: `${args.songTitle} is right where you left it.`,
    bodyHtml:
      p(`It's all still here — every memo, every line, exactly as you left it.`) +
      p(`When you've got a spare two minutes, one small addition is enough to feel the thread again.`),
    ctaLabel: "Pick it back up",
    ctaUrl: `${APP_URL}/songs/${args.songId}`,
    category: "retain",
    categoryLabel: "return reminders",
  });
  return { subject: `${args.songTitle} is right where you left it`, html, text };
}

/** E3 · growth.reward_* — the LIVE reward mail, re-skinned through the shell. */
export function rewardEmail(kind: string, amountCents: number | null): RenderedTemplate {
  const usd = amountCents != null ? `$${(amountCents / 100).toFixed(2)}` : "your reward";
  const copy: Record<string, { subject: string; headline: string; body: string }> = {
    reward_minted: {
      subject: `New referral reward — ${usd} pending`,
      headline: "Someone you brought in just made this their home.",
      body: `A friend you referred just paid for their own room. Your reward of <strong>${usd}</strong> is pending — it becomes payable after the 30-day hold.`,
    },
    reward_matured: {
      subject: `Your reward of ${usd} is ready for payout`,
      headline: "Your reward is ready.",
      body: `Your reward of <strong>${usd}</strong> has matured and will be included in the next monthly payout draft.`,
    },
    reward_paid: {
      subject: `Reward of ${usd} marked paid`,
      headline: "Thank you for bringing people into the room.",
      body: `Your reward of <strong>${usd}</strong> has been marked paid.`,
    },
    payout_approved: {
      subject: `Payout of ${usd} approved`,
      headline: "Your payout is on its way.",
      body: `Your payout of <strong>${usd}</strong> has been approved and is queued for sending.`,
    },
    payout_sent: {
      subject: `Payout of ${usd} sent`,
      headline: "Your payout has been sent.",
      body: `Your payout of <strong>${usd}</strong> is on its way. Watch for it on your chosen payout method.`,
    },
    payout_failed: {
      subject: `Payout of ${usd} failed — action needed`,
      headline: "Your payout needs a quick fix.",
      body: `Your payout of <strong>${usd}</strong> failed to send. Please update your payout method in Settings, or reply to this email and we'll help.`,
    },
  };
  const c = copy[kind] ?? {
    subject: "Update from Colors of Glory",
    headline: "A quick update.",
    body: "There's an update on your referral rewards.",
  };
  const { html, text } = renderEmail({
    preheader: c.subject,
    headline: c.headline,
    bodyHtml: p(c.body),
    ctaLabel: "See your referrals",
    ctaUrl: `${APP_URL}/settings/referral`,
    category: "growth",
    transactional: true,
    transactionalNote: "This is a service message about your referral rewards.",
  });
  return { subject: c.subject, html, text };
}
