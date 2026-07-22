// Central registry of every transactional template renderer.
// One place to look up "welcome" → { subject, html, text } given templateData.
// Adding a new template = one entry here + one exported renderer in ./email.ts.
//
// Every renderer returns { subject, html, text } from the shared renderEmail()
// shell, so brand + footer + preview text stay in lockstep.

import {
  RenderedTemplate,
  welcomeEmail,
  firstSongNudgeEmail,
  whatChangedEmail,
  humCaptureEmail,
  lyricsChordsEmail,
  firstCollaboratorEmail,
  referralExplainerEmail,
  firstCaptureWinEmail,
  roomReadyEmail,
  stalledSongEmail,
  yourWeekEmail,
  inviteNudgeEmail,
  gentleReturnEmail,
  inviteEmail,
  inviteReminderEmail,
  inviteAcceptedEmail,
  rewardEmail,
  otpCodeEmail,
  passwordChangedEmail,
} from "./email.ts";

export interface TemplateEntry {
  category: string;
  render: (data: Record<string, unknown>) => RenderedTemplate;
  /** Data used to power the preview surface (must satisfy the render function). */
  previewData: Record<string, unknown>;
  /** Human label shown in the preview index. */
  displayName: string;
}

function pickString(data: Record<string, unknown>, key: string, fallback = ""): string {
  const v = data[key];
  return typeof v === "string" ? v : fallback;
}

function pickNumber(data: Record<string, unknown>, key: string, fallback = 0): number {
  const v = data[key];
  return typeof v === "number" ? v : fallback;
}

function pickStringArray(data: Record<string, unknown>, key: string): string[] {
  const v = data[key];
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : [];
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  // ─── AUTH ────────────────────────────────────────────────────────────
  "otp-signup": {
    category: "auth",
    displayName: "OTP · signup code",
    previewData: { code: "482913", purpose: "signup" },
    render: (d) => otpCodeEmail({ code: pickString(d, "code", "000000"), purpose: "signup" }),
  },
  "otp-login": {
    category: "auth",
    displayName: "OTP · login code",
    previewData: { code: "482913", purpose: "login" },
    render: (d) => otpCodeEmail({ code: pickString(d, "code", "000000"), purpose: "login" }),
  },
  "otp-reset": {
    category: "auth",
    displayName: "OTP · reset code",
    previewData: { code: "482913", purpose: "reset" },
    render: (d) => otpCodeEmail({ code: pickString(d, "code", "000000"), purpose: "reset" }),
  },
  "password-changed": {
    category: "auth",
    displayName: "Password changed confirmation",
    previewData: { firstName: "Parker" },
    render: (d) => passwordChangedEmail({ firstName: pickString(d, "firstName", "") || null }),
  },

  // ─── ONBOARDING ──────────────────────────────────────────────────────
  "welcome": {
    category: "onboarding",
    displayName: "Welcome",
    previewData: { firstName: "Parker" },
    render: (d) => welcomeEmail({ firstName: pickString(d, "firstName", "") || null }),
  },
  "first-song-nudge": {
    category: "onboarding",
    displayName: "First song nudge",
    previewData: {},
    render: () => firstSongNudgeEmail(),
  },
  "first-capture-win": {
    category: "onboarding",
    displayName: "First capture win",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => firstCaptureWinEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },
  "room-ready": {
    category: "onboarding",
    displayName: "Room ready",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => roomReadyEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },
  "stalled-song": {
    category: "onboarding",
    displayName: "Stalled song (day 3)",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => stalledSongEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },

  // ─── EDUCATION ───────────────────────────────────────────────────────
  "hum-capture": {
    category: "edu",
    displayName: "Hum capture tip",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => humCaptureEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },
  "lyrics-chords": {
    category: "edu",
    displayName: "Lyrics & chords tip",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => lyricsChordsEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },

  // ─── COLLAB ──────────────────────────────────────────────────────────
  "invite": {
    category: "collab",
    displayName: "Collaborator invite",
    previewData: { inviterName: "Sarah", songTitle: "Untitled Sunday", role: "collaborator", personalNote: "Would love your ear on the bridge.", token: "preview-token" },
    render: (d) => inviteEmail({
      inviterName: pickString(d, "inviterName", "A friend"),
      songTitle: pickString(d, "songTitle", "a song"),
      role: pickString(d, "role", "collaborator"),
      personalNote: pickString(d, "personalNote", "") || null,
      token: pickString(d, "token", ""),
    }),
  },
  "invite-reminder": {
    category: "collab",
    displayName: "Invite reminder (+3 days)",
    previewData: { inviterName: "Sarah", songTitle: "Untitled Sunday", token: "preview-token" },
    render: (d) => inviteReminderEmail({
      inviterName: pickString(d, "inviterName", "A friend"),
      songTitle: pickString(d, "songTitle", "a song"),
      token: pickString(d, "token", ""),
    }),
  },
  "invite-accepted": {
    category: "collab",
    displayName: "Invite accepted (to inviter)",
    previewData: { inviteeName: "Caleb", songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000", role: "collaborator" },
    render: (d) => inviteAcceptedEmail({
      inviteeName: pickString(d, "inviteeName", "Someone"),
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
      role: pickString(d, "role", "collaborator"),
    }),
  },
  "first-collaborator": {
    category: "collab",
    displayName: "First collaborator moment",
    previewData: { inviteeName: "Caleb", songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => firstCollaboratorEmail({
      inviteeName: pickString(d, "inviteeName", "Someone"),
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },

  // ─── DIGEST ──────────────────────────────────────────────────────────
  "what-changed": {
    category: "digest",
    displayName: "What changed this week",
    previewData: {
      songTitle: "Untitled Sunday",
      songId: "00000000-0000-0000-0000-000000000000",
      lines: ["Sarah added a voice memo", "Caleb rearranged 2 ideas", "Parker moved an idea into Final"],
    },
    render: (d) => whatChangedEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
      lines: pickStringArray(d, "lines"),
    }),
  },
  "your-week": {
    category: "digest",
    displayName: "Your solo week",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000", ideaCount: 4 },
    render: (d) => yourWeekEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
      ideaCount: pickNumber(d, "ideaCount", 0),
    }),
  },

  // ─── GROWTH & RETENTION ──────────────────────────────────────────────
  "referral-explainer": {
    category: "growth",
    displayName: "Referral explainer",
    previewData: {},
    render: () => referralExplainerEmail(),
  },
  "invite-nudge": {
    category: "growth",
    displayName: "Invite nudge (someone want in?)",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => inviteNudgeEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },
  "gentle-return": {
    category: "retain",
    displayName: "Gentle return (14 days)",
    previewData: { songTitle: "Untitled Sunday", songId: "00000000-0000-0000-0000-000000000000" },
    render: (d) => gentleReturnEmail({
      songTitle: pickString(d, "songTitle", "your song"),
      songId: pickString(d, "songId", ""),
    }),
  },

  // ─── REWARDS ─────────────────────────────────────────────────────────
  "reward-minted": {
    category: "money",
    displayName: "Reward minted (pending)",
    previewData: { amountCents: 500 },
    render: (d) => rewardEmail("reward_minted", (d.amountCents as number) ?? null),
  },
  "reward-matured": {
    category: "money",
    displayName: "Reward matured (payable)",
    previewData: { amountCents: 500 },
    render: (d) => rewardEmail("reward_matured", (d.amountCents as number) ?? null),
  },
  "reward-paid": {
    category: "money",
    displayName: "Reward marked paid",
    previewData: { amountCents: 500 },
    render: (d) => rewardEmail("reward_paid", (d.amountCents as number) ?? null),
  },
  "payout-approved": {
    category: "money",
    displayName: "Payout approved",
    previewData: { amountCents: 5000 },
    render: (d) => rewardEmail("payout_approved", (d.amountCents as number) ?? null),
  },
  "payout-sent": {
    category: "money",
    displayName: "Payout sent",
    previewData: { amountCents: 5000 },
    render: (d) => rewardEmail("payout_sent", (d.amountCents as number) ?? null),
  },
  "payout-failed": {
    category: "money",
    displayName: "Payout failed",
    previewData: { amountCents: 5000 },
    render: (d) => rewardEmail("payout_failed", (d.amountCents as number) ?? null),
  },
};

export function listTemplates(): { name: string; entry: TemplateEntry }[] {
  return Object.entries(TEMPLATES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => ({ name, entry }));
}

export function getTemplate(name: string): TemplateEntry | null {
  return TEMPLATES[name] ?? null;
}