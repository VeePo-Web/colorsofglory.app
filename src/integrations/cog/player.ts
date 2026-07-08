/**
 * Take-player contract. Types ONLY — the player itself is
 * `src/components/voice/TakeMiniPlayer.tsx` (C4): a single shared <audio>
 * element driven by React state/hooks, the app's established pattern (A4).
 * (An earlier note here said "Zustand store" — that was stale; the app does
 * not use Zustand, and the built player follows the context/hook convention.)
 *
 * `queue` is the sibling takes of the SAME memo — the swipe/chevron versions
 * (F15). This is distinct from F2's practice global mini-player.
 */

export type PlayerSource =
  | { kind: "take"; take_id: string; voice_memo_id: string; song_id: string }
  | { kind: "voice_memo"; voice_memo_id: string; song_id: string };

export type PlayerTake = {
  take_id: string;
  voice_memo_id: string;
  song_id: string;
  song_title: string;
  friendly_name: string;
  duration_ms: number | null;
  signed_url: string; // short-lived, refresh before expiry
  waveform_peaks: number[] | null;
};

export type PlayerState = {
  current: PlayerTake | null;
  queue: PlayerTake[]; // other takes of the same memo for the chevron
  isPlaying: boolean;
  positionMs: number;
  expanded: boolean;
};