/**
 * Version History contract — Collaboration & Song Memory lane.
 *
 * Reads the real `song_versions` table (kind: manual | auto | restore_point;
 * snapshot JSON; version_number; parent_version_id). The UI NEVER renders the
 * raw snapshot content — only human-readable metadata (who/when/what), per
 * Product Vision 09 (no diffs/commit-hashes by default).
 *
 * Restore is SERVER-AUTHORITATIVE and additive: it must create a NEW current
 * version from the chosen snapshot and preserve the prior draft in history. The
 * client never assembles a new current version from raw state. We call an RPC
 * (`restore_song_version`); until the backend ships it, we surface a calm typed
 * `RESTORE_UNAVAILABLE` so the screen can degrade gracefully instead of dying.
 * See docs/claude-handoffs for the RPC contract handed to Lovable.
 */
import { supabase } from "@/integrations/supabase/client";
import { CogError } from "./songs";

export type VersionKind = "manual" | "auto" | "restore_point";

export type SongVersion = {
  id: string;
  songId: string;
  versionNumber: number;
  kind: VersionKind;
  label: string | null;
  description: string | null;
  createdByUserId: string;
  createdAt: string;
  parentVersionId: string | null;
};

function mapRow(row: {
  id: string;
  song_id: string;
  version_number: number;
  kind: VersionKind;
  label: string | null;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
  parent_version_id: string | null;
}): SongVersion {
  return {
    id: row.id,
    songId: row.song_id,
    versionNumber: row.version_number,
    kind: row.kind,
    label: row.label,
    description: row.description,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    parentVersionId: row.parent_version_id,
  };
}

/**
 * Versions for a song, newest first. Membership is enforced by RLS — a caller
 * without access gets an empty list rather than an error.
 */
export async function listSongVersions(
  songId: string,
  limit = 50,
): Promise<SongVersion[]> {
  const { data, error } = await supabase
    .from("song_versions")
    .select(
      "id, song_id, version_number, kind, label, description, created_by_user_id, created_at, parent_version_id",
    )
    .eq("song_id", songId)
    .order("version_number", { ascending: false })
    .limit(limit);

  if (error) {
    // RLS denial / empty access reads as no history, not a scary failure.
    if (error.code === "PGRST116") return [];
    throw new CogError(error.code ?? "INTERNAL", error.message);
  }
  return (data ?? []).map(mapRow);
}

export type RestoreResult = {
  newVersionId: string | null;
  newVersionNumber: number | null;
};

/**
 * Restore a prior version. Server-side + additive: creates a new current
 * version from the selected snapshot and keeps the previous draft in history.
 * Owner-gated server-side. Throws `RESTORE_UNAVAILABLE` if the backend RPC is
 * not yet deployed so the UI can show a calm message instead of failing hard.
 */
export async function restoreSongVersion(
  songId: string,
  versionId: string,
): Promise<RestoreResult> {
  // RPC isn't in the generated types yet — same `as any` escape the activity
  // layer uses for not-yet-typed RPCs (see integrations/cog/activity.ts).
  const { data, error } = await (supabase as any).rpc("restore_song_version", {
    _song_id: songId,
    _version_id: versionId,
  });

  if (error) {
    const missing =
      error.code === "42883" ||
      error.code === "PGRST202" ||
      /function .* does not exist|could not find the function/i.test(
        error.message ?? "",
      );
    if (missing) {
      throw new CogError(
        "RESTORE_UNAVAILABLE",
        "restore_song_version is not available yet",
      );
    }
    throw new CogError(error.code ?? "INTERNAL", error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { new_version_id?: string; new_version_number?: number }
    | null
    | undefined;
  return {
    newVersionId: row?.new_version_id ?? null,
    newVersionNumber: row?.new_version_number ?? null,
  };
}
