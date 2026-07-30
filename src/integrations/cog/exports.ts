import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

/**
 * R14 — Taking the song with you.
 *
 * One request returns everything a lyric sheet, a credits sheet, or a plain-text
 * share needs. No per-panel fan-out, no partial exports: if this resolves, the
 * export is complete and consistent as of `generated_at`.
 *
 * Any member (including view-only) may export. Non-members are refused with
 * `not_a_member`.
 */

export type ExportSection = {
  section_id: string;
  label: string;
  kind: string;
  position: number;
  /** Versioned line/anchor JSON (same shape sheet.ts decodes) — chords included. */
  content: unknown | null;
  plain_text: string;
  updated_at: string | null;
};

export type ExportTake = {
  take_id: string;
  name: string;
  duration_ms: number | null;
  is_primary: boolean;
  created_by: string;
  created_at: string;
};

export type ExportCredit = {
  user_id: string;
  name: string;
  role: "owner" | "collaborator" | "viewer" | string;
  joined_at: string;
  /** e.g. ["Lyrics", "Voice memo", "Ideas"] — derived from real contributions. */
  contributions: string[];
};

export type SongExportPayload = {
  song: {
    id: string;
    title: string;
    key_signature: string | null;
    tempo_bpm: number | null;
    time_signature: string | null;
    dedication: string | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
    owner_user_id: string;
  };
  sheet_meta: Record<string, unknown>;
  sections: ExportSection[];
  takes: ExportTake[];
  credits: ExportCredit[];
  generated_at: string;
};

export async function getSongExportPayload(songId: string): Promise<SongExportPayload> {
  const { data, error } = await (supabase as any).rpc("song_export_payload", { _song_id: songId });
  if (error) throw toCogError(error);
  return data as SongExportPayload;
}

/**
 * Plain-text lyric sheet — the share format people actually paste into a text
 * message or a band chat. Deliberately unstyled and lossless enough to read.
 */
export function toPlainTextSheet(payload: SongExportPayload): string {
  const { song, sections } = payload;
  const head = [
    song.title,
    [song.key_signature ? `Key ${song.key_signature}` : null, song.tempo_bpm ? `${song.tempo_bpm} BPM` : null]
      .filter(Boolean)
      .join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
  const body = sections
    .map((s) => `${s.label}\n${s.plain_text || "—"}`)
    .join("\n\n");
  return [head, body].filter(Boolean).join("\n\n").trim() + "\n";
}

/** Credits block, in the wording the Credits screen already uses. */
export function toCreditsText(payload: SongExportPayload): string {
  return payload.credits
    .map((c) => {
      const parts = [c.role === "owner" ? "Owner" : c.role === "viewer" ? "Listener" : "Collaborator", ...c.contributions];
      return `${c.name} — ${parts.join(" · ")}`;
    })
    .join("\n");
}
