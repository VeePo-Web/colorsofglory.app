/**
 * Global player contract. Types ONLY — the player itself is a frontend
 * concern (Zustand store + single shared <audio> element) owned by Claude.
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