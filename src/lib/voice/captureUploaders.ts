import { registerOutboxUploader } from "./captureOutbox";
import { uploadVoiceMemo as uploadBrainstormMemo } from "@/integrations/cog/memos";

/**
 * Startup registration of every non-default Capture Outbox uploader.
 *
 * Importing this module (once, from the app entry) teaches the outbox how to
 * sync takes through each pipeline BEFORE the surface that uses it has mounted.
 * That closes the retry-after-reload gap: a brainstorm take queued offline will
 * resume syncing on reconnect even if the songwriter reloaded onto a different
 * screen and never reopened the brainstorm page.
 *
 * The default in-song ("voiceApi") uploader is registered inside captureOutbox
 * itself; this module covers the rest.
 */

// Brainstorm uses its own pipeline (integrations/cog/memos), carrying waveform
// peaks via the job's serializable `extra`.
registerOutboxUploader("memos", (job, blob) =>
  uploadBrainstormMemo({
    songId: job.songId,
    blob,
    mimeType: job.mimeType,
    durationMs: job.durationMs,
    title: job.title,
    waveformPeaks: (job.extra?.waveformPeaks as number[] | undefined) ?? undefined,
  }),
);
