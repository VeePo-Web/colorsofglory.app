import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const { memo_id } = await req.json().catch(() => ({}));
    if (typeof memo_id !== "string") return jsonResponse({ error: "memo_id_required" }, 400);

    const admin = adminClient();
    const { data: memo } = await admin
      .from("voice_memos")
      .select("id, song_id, author_user_id, storage_path, status")
      .eq("id", memo_id)
      .maybeSingle();
    if (!memo) return jsonResponse({ error: "not_found" }, 404);

    const { data: isOwner } = await admin.rpc("is_song_owner", { _song_id: memo.song_id, _user_id: user.id });
    if (memo.author_user_id !== user.id && !isOwner) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    // Remove storage object (best-effort) then mark deleted so storage trigger reverses bytes.
    if (memo.storage_path) {
      const { error: rmErr } = await admin.storage.from("voice-memos").remove([memo.storage_path]);
      if (rmErr) console.warn("voice-memo-delete storage remove failed", rmErr.message);
    }

    // Clean up transcript first to satisfy FK.
    await admin.from("voice_memo_transcripts").delete().eq("memo_id", memo_id);
    const { error: delErr } = await admin.from("voice_memos").delete().eq("id", memo_id);
    if (delErr) return jsonResponse({ error: delErr.message }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "delete_voice_memo",
      entity_type: "voice_memo",
      entity_id: memo_id,
      before: memo,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
