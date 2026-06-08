# Handoff — Persistent Mini-Player

_Owner: Claude (pure frontend). SDK contract: `src/integrations/cog/player.ts` (types only)._

## Architecture
- Mount `<MiniPlayerHost />` once in root layout. Hidden when `state.current === null`.
- Sits in the same bottom dock as the CaptureBar — mini-player is the upper layer (z-index above the bar, both above page content).
- Single shared `<audio>` element ref held by the store — never mount per-row players.
- Zustand store `usePlayerStore`: `{ current: PlayerTake | null, queue: PlayerTake[], isPlaying, positionMs, expanded }` (see `player.ts`).

## Loading a take
1. Caller fetches takes via `listTakes(voice_memo_id)`.
2. Builds `PlayerTake` rows, calling `getTakeSignedUrl(storage_path)` for each.
3. Calls `usePlayerStore.getState().play({ current, queue })`.
4. Refresh signed URL when within 5 min of expiry.

## Mini-player anatomy (64px)
- Left: 40px gold-tinted sparkline (reuse `waveform_peaks`).
- Middle: friendly_name (truncate) + song_title (warm-gray, smaller).
- Right: play/pause · next-take chevron (cycles `queue`) · X (stop + clear).
- Middle tap → navigate `/song/:id/voice?memo=…&take=…`.
- Swipe up → expanded overlay: full scrubber, take selector, attached lyrics if memo is section-linked.

## Media Session API (PWA lock-screen)
```ts
navigator.mediaSession.metadata = new MediaMetadata({
  title: current.friendly_name,
  artist: current.song_title,
  album: "Colors of Glory",
});
navigator.mediaSession.setActionHandler("play", () => store.resume());
navigator.mediaSession.setActionHandler("pause", () => store.pause());
navigator.mediaSession.setActionHandler("nexttrack", () => store.next());
```

## Anti-patterns
- No autoplay of next memo after one ends. Chevron is explicit.
- No download or share affordances in the mini-player; those live in the takes drawer `…` menu.
- No badge counts. No "Now Playing" pill spam.