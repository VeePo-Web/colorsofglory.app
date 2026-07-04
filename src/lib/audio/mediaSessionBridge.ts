/** Updates the browser MediaSession metadata + action handlers. */
export function updateMediaSession(params: {
  sectionLabel: string;
  loopCount: number;
  songTitle: string;
  durationMs: number;
  positionMs: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRestartCurrent: () => void;
  /** Album mode only — when set, the lock-screen ⏮/⏭ skip whole songs. */
  onPrevSong?: () => void;
  onNextSong?: () => void;
}): void {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${params.sectionLabel} · ×${params.loopCount}`,
    artist: "Colors of Glory",
    album: params.songTitle,
    artwork: [
      { src: "/cog-practice-artwork.png", sizes: "512x512", type: "image/png" },
    ],
  });

  // seekbackward = restart THIS section (most useful while driving).
  // In album mode the ⏮/⏭ track buttons skip whole songs (hands-free song
  // change in the car); seekforward still advances one section.
  const albumMode = Boolean(params.onNextSong && params.onPrevSong);
  navigator.mediaSession.setActionHandler("play",          params.onPlay);
  navigator.mediaSession.setActionHandler("pause",         params.onPause);
  navigator.mediaSession.setActionHandler("seekbackward",  params.onRestartCurrent);
  navigator.mediaSession.setActionHandler("seekforward",   params.onNext);
  navigator.mediaSession.setActionHandler("previoustrack", albumMode ? params.onPrevSong! : params.onPrev);
  navigator.mediaSession.setActionHandler("nexttrack",     albumMode ? params.onNextSong! : params.onNext);

  try {
    navigator.mediaSession.setPositionState({
      duration:      Math.max(params.durationMs / 1000, 0.1),
      playbackRate:  params.playbackRate,
      position:      Math.min(params.positionMs / 1000, params.durationMs / 1000),
    });
  } catch { /* setPositionState not supported on all browsers */ }
}

export function setMediaSessionPlaybackState(
  state: "playing" | "paused" | "none",
): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = state;
}

export function clearMediaSession(): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  const noop = null;
  navigator.mediaSession.setActionHandler("play",          noop);
  navigator.mediaSession.setActionHandler("pause",         noop);
  navigator.mediaSession.setActionHandler("seekbackward",  noop);
  navigator.mediaSession.setActionHandler("seekforward",   noop);
  navigator.mediaSession.setActionHandler("previoustrack", noop);
  navigator.mediaSession.setActionHandler("nexttrack",     noop);
  navigator.mediaSession.playbackState = "none";
}
