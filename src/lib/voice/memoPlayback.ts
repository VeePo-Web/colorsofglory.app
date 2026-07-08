/**
 * Play-before-upload rule (Apple Voice Memos behavior): a just-captured take is
 * playable the instant it exists, straight from the local cached blob — even
 * while it is still queued/uploading and has no server record yet.
 *
 * A memo is playable when EITHER the server says it's ready, OR we hold its blob
 * locally (the Capture Outbox cached it under the card's id before any upload).
 */
export function canPlayMemo(opts: { isReady: boolean; hasLocalBlob: boolean }): boolean {
  return opts.isReady || opts.hasLocalBlob;
}
