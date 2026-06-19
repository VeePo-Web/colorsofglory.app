import { z } from "https://esm.sh/zod@3.23.8";
import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

const InputSchema = z.object({
  capture_id: z.string().uuid(),
  target_song_id: z.string().uuid().optional(),
  target_tree: z.enum(["ideas", "final"]).default("ideas"),
  section_label: z.string().max(120).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

function err(code: string, status: number, detail?: unknown) {
  return jsonResponse({ error: code, detail }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  const user = await resolveUser(req);
  if (!user) return err("unauthenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_json", 400);
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) return err("invalid_input", 400, parsed.error.flatten());
  const input = parsed.data;

  const admin = adminClient();

  // 1. Load capture
  const { data: capture, error: capErr } = await admin
    .from("idea_captures")
    .select("id, song_id, author_user_id, title, lyric_snippet, voice_memo_id, promoted_card_id")
    .eq("id", input.capture_id)
    .maybeSingle();
  if (capErr) return err("db_error", 500, capErr.message);
  if (!capture) return err("capture_not_found", 404);

  // 2. Resolve song
  const song_id = capture.song_id ?? input.target_song_id ?? null;
  if (!song_id) return err("missing_song", 400);

  // 3. Authz — must be owner or collaborator of song
  const { data: role, error: roleErr } = await admin.rpc("song_role", {
    _song_id: song_id,
    _user_id: user.id,
  });
  if (roleErr) return err("db_error", 500, roleErr.message);
  if (!role) return err("not_a_member", 403);
  if (role !== "owner" && role !== "collaborator") return err("insufficient_role", 403);

  // 4. Idempotency — existing card from this capture
  const { data: existing } = await admin
    .from("canvas_cards")
    .select("id, take_id")
    .eq("source_capture_id", capture.id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      card_id: existing.id,
      take_id: existing.take_id,
      transcript_pending: false,
      already_promoted: true,
    });
  }

  // 5. Find latest take tied to capture's voice memo (if any)
  let take_id: string | null = null;
  let take_transcript_status: string | null = null;
  if (capture.voice_memo_id) {
    const { data: take } = await admin
      .from("takes")
      .select("id, transcript_status")
      .eq("voice_memo_id", capture.voice_memo_id)
      .eq("song_id", song_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (take) {
      take_id = take.id;
      take_transcript_status = take.transcript_status;
    }
  }

  // 6. Compute next position
  const { data: posRow } = await admin
    .from("canvas_cards")
    .select("position")
    .eq("song_id", song_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (posRow?.position ?? -1) + 1;

  // 7. Insert canvas card
  const { data: card, error: insErr } = await admin
    .from("canvas_cards")
    .insert({
      song_id,
      created_by: user.id,
      take_id,
      kind: "idea",
      label: capture.title,
      body: capture.lyric_snippet ?? "",
      position: nextPosition,
      x: input.x ?? null,
      y: input.y ?? null,
      tree_kind: input.target_tree,
      section_label: input.section_label ?? null,
      source_capture_id: capture.id,
    })
    .select("id")
    .single();
  if (insErr || !card) return err("insert_failed", 500, insErr?.message);

  // 8. Update capture pointer
  await admin
    .from("idea_captures")
    .update({ promoted_card_id: card.id })
    .eq("id", capture.id);

  // 9. Fire-and-forget transcription if needed
  let transcript_pending = false;
  if (take_id && (take_transcript_status === "none" || take_transcript_status === "failed")) {
    transcript_pending = true;
    const authHeader = req.headers.get("Authorization") ?? "";
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-take`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ take_id }),
    }).catch((e) => console.warn("transcribe-take invoke failed", e));
  }

  return jsonResponse({
    card_id: card.id,
    take_id,
    transcript_pending,
    already_promoted: false,
  });
});