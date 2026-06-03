import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const { song_id } = await req.json().catch(() => ({}));
    if (typeof song_id !== "string") return jsonResponse({ error: "song_id_required" }, 400);

    const admin = adminClient();
    const { data: song } = await admin.from("songs").select("id, owner_user_id, status").eq("id", song_id).maybeSingle();
    if (!song) return jsonResponse({ error: "not_found" }, 404);
    if (song.owner_user_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);

    const { error: updErr } = await admin
      .from("songs")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", song_id);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "delete_song",
      entity_type: "song",
      entity_id: song_id,
      before: song,
    });

    return jsonResponse({ ok: true, song_id });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
