# R40 — Songwriting Room Audit: "Press play and it plays"

**Owner:** Claude (frontend)
**Backend:** shipped — `src/integrations/cog/audio.ts`
**Goal of the room:** the song stays in one place, and nothing between the writer and the song is allowed to feel slow.

---

## The finding

Voice is first-class content in this room, but audio was the slowest thing in it.
Every take lives in a private bucket, so each press of play cost a signed-URL
round-trip *before* the first sound. On a phone on church wifi that is
300–900 ms of nothing. The writer taps, hears silence, taps again.

There is no new UI to invent here. This is a flow fix: the room should already
be holding the audio by the time a finger lands.

## What backend now provides

`src/integrations/cog/audio.ts`

| Function | Use |
|---|---|
| `prewarmAudio(paths)` | One request mints signed URLs for a whole board/drawer. Cached in memory + sessionStorage for an hour. |
| `cachedAudioUrl(path)` | **Synchronous.** Returns a warm URL or `null`. Use it in render — no await, no spinner. |
| `audioUrl(path)` | Async fallback for a cold path. Concurrent callers share one request. |
| `preloadAudioBytes(url)` | Pulls the first ~96 KB into the HTTP cache so playback starts instantly. |
| `preloadNext(paths, i)` | Warms the take after the current one. |
| `clearAudioCache()` | Call on sign-out. |

## What to build

1. **Warm on arrival.** Wherever a list of audio appears (voice board, takes
   drawer, listen path, compare sheet, feed rows with a take), call
   `prewarmAudio()` once with every visible `storage_path` right after the data
   query resolves. One request, whole screen ready.
2. **Render from cache, never from a promise.** Play buttons read
   `cachedAudioUrl(path)` synchronously. If it returns a URL, the button is
   live immediately. If `null`, still show the button enabled — call
   `audioUrl()` on press and start playback when it lands. Never show a
   spinner in place of a play button.
3. **Always be one ahead.** In the listen path, takes drawer and compare sheet,
   call `preloadNext(paths, currentIndex)` whenever the current index changes.
   Swiping between takes must be gapless.
4. **Warm on intent, not just on view.** On `pointerdown` (not click) of any
   play control, fire `preloadAudioBytes(url)`. The ~120 ms between press and
   release is free head start.
5. **Failure is honest, not eternal.** If a path never signs, the card reads
   *"This recording can't be reached right now"* with a Try again link —
   charcoal text, no red, no toast.

## Rules

- No loading spinners anywhere on a play control.
- Do not re-request a URL that is already warm; the cache handles expiry.
- No autoplay. Warming is silent — bytes only, never sound.
- Cream/gold only: the play affordance stays gold, the waveform stays gold.
- Simplicity check: this ships as caching behaviour behind existing buttons.
  If it adds a single new visible control, it is wrong.

## Done when

- On a cold room load, the first tap on any take produces sound with no
  visible delay.
- Swiping through five takes in the drawer never shows a loading state.
- Network panel shows **one** signed-URL request per screen, not one per card.
