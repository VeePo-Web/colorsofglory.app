import type { CanvasBoardCardType } from "./canvasTypes";

/**
 * glorySpectrum — the canvas's color LANGUAGE, grown from the 6-digit auth
 * code's ROYGBV "power-up" moment (src/components/cog/OTPInput.tsx). The same
 * warmed jewel tones — with the brand gold as the Y slot tying the spectrum to
 * the brand — expanded from six digit cells into a songwriting workspace:
 *
 *   color says WHAT KIND of creative material a card holds,
 *   gold says THE SYSTEM is speaking (CTAs, selection, waveforms),
 *   creator colors say WHO (dot + name only — never the card's identity).
 *
 * Everything here is an ACCENT layer over the locked cream/gold base: tints at
 * ≤10% opacity, glows at ≤20%, full hues only on icons/eyebrows/thin stripes.
 * Never a rainbow border, never a color field louder than the words on the card.
 */

export interface GloryTone {
  /** Full-strength hue — icon, eyebrow, identity stripe. */
  base: string;
  /** Darkened — readable text on cream (≥4.5:1 on #FFFCF7). */
  dark: string;
  /** ~8% tint — icon chip fill. */
  bg: string;
  /** ~18% — soft glow shadows. */
  glow: string;
  /** ~35% — dim borders. */
  dim: string;
}

const tone = (base: string, dark: string): GloryTone => ({
  base,
  dark,
  bg: `${base}14`,
  glow: `${base}2E`,
  dim: `${base}59`,
});

/** The auth-code palette, verbatim hues (OTPInput CELL_HUES) + dark pairs. */
export const GLORY = {
  crimson: tone("#C94F4F", "#983A34"), // R
  amber:   tone("#CE7A3B", "#96551F"), // O
  gold:    tone("#B8953A", "#8A6D2A"), // Y — the brand gold
  sage:    tone("#6E9B63", "#48703F"), // G
  cobalt:  tone("#5C7FB8", "#3D5C8F"), // B — dusty, warmed; never corporate
  violet:  tone("#8A64A8", "#63447E"), // V
} as const;

/** Pale-gold sibling for the harmonic bed (chords) — same family as voice
 *  gold, one register lighter, so audio and harmony read as kin. */
export const GLORY_PALE_GOLD = tone("#C4A75B", "#8A6D2A");

/** Quiet parchment for freeform notes — a raw thought stays humble. */
export const GLORY_STONE = tone("#8B8272", "#5F594D");

/**
 * The material language: which glory tone each card TYPE wears. This is the
 * canvas's answer to "can I tell lyrics, voice, chords, and meaning apart
 * before reading a word?"
 */
export const TYPE_TONE: Record<CanvasBoardCardType, GloryTone> = {
  lyric: GLORY.crimson,      // the words — soft rose
  voice: GLORY.gold,         // recorded takes — the golden center
  hum: GLORY.amber,          // raw hums — warm, unfinished
  chord: GLORY_PALE_GOLD,    // the harmonic bed — pale gold
  scripture: GLORY.sage,     // meaning anchors — green
  note: GLORY_STONE,         // free thoughts — parchment
  section: GLORY.gold,       // arrangement blocks — system gold
};

/** Playback is a soft-blue moment (listen path badges, the now-sounding ring). */
export const PLAYBACK_TONE = GLORY.cobalt;

/** Pending review is warm amber — attention, never alarm. */
export const REVIEW_TONE = GLORY.amber;

/** Compare mode's two-tone edge: take A vs take B. */
export const COMPARE_A_TONE = GLORY.crimson;
export const COMPARE_B_TONE = GLORY.violet;

// ─── Composite recipes ──────────────────────────────────────────────────────

/** Selected card: gold ring + a faint spectral bloom leaking from the edges —
 *  the auth-code success glow, resting on one card. */
export const GLORY_SELECTED_SHADOW =
  `0 0 0 4px rgba(184,149,58,0.18), ` +
  `0 16px 40px -10px rgba(184,149,58,0.30), ` +
  `-16px 8px 34px -18px ${GLORY.crimson.base}4D, ` +
  `16px 8px 34px -18px ${GLORY.cobalt.base}4D, ` +
  `0 -12px 30px -18px ${GLORY.sage.base}40`;

/** Now-sounding card: a soft cobalt halo (playback's color, breathing). */
export const GLORY_PLAYING_SHADOW =
  `0 0 0 4px ${GLORY.cobalt.base}26, 0 12px 34px -8px ${GLORY.cobalt.base}47`;

/**
 * The room's light — the viewport backdrop. Five ultra-soft radial washes (one
 * per spectrum stop) around a warm gold center of gravity, on cream. One fixed
 * layer, zero per-card cost.
 */
export const GLORY_FIELD_BACKGROUND =
  `radial-gradient(42% 30% at 16% 18%, ${GLORY.crimson.base}0D 0%, transparent 70%), ` +
  `radial-gradient(38% 28% at 84% 22%, ${GLORY.cobalt.base}0D 0%, transparent 70%), ` +
  `radial-gradient(36% 26% at 76% 80%, ${GLORY.sage.base}0F 0%, transparent 70%), ` +
  `radial-gradient(44% 32% at 22% 82%, ${GLORY.amber.base}12 0%, transparent 70%), ` +
  `radial-gradient(64% 48% at 50% 44%, ${GLORY.gold.base}1A 0%, transparent 72%)`;

/** The spectral crown — the OTP row as a 3px bar (root card, arrangement rail). */
export const GLORY_CROWN_GRADIENT =
  `linear-gradient(90deg, ${GLORY.crimson.base}B3, ${GLORY.amber.base}B3, ` +
  `${GLORY.gold.base}, ${GLORY.sage.base}B3, ${GLORY.cobalt.base}B3, ${GLORY.violet.base}B3)`;

/** Soft aura behind a live recording's waveform — glory light while you sing. */
export const GLORY_RECORDING_AURA =
  `radial-gradient(48% 60% at 50% 50%, ${GLORY.gold.base}26 0%, transparent 70%), ` +
  `radial-gradient(70% 80% at 30% 50%, ${GLORY.amber.base}17 0%, transparent 72%), ` +
  `radial-gradient(70% 80% at 70% 50%, ${GLORY.crimson.base}12 0%, transparent 72%)`;
