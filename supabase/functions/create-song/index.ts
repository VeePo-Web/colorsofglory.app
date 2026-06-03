import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) return jsonResponse({ error: "invalid_title" }, 400);

    const admin = adminClient();

    // Free-plan gate. Pro / Founder Pro bypass.
    const { data: allowed, error: gateErr } = await admin.rpc("can_create_song", { _user_id: user.id });
    if (gateErr) return jsonResponse({ error: gateErr.message }, 500);
    if (!allowed) return jsonResponse({ error: "song_limit_reached", code: "free_plan_limit" }, 402);

    const insert: Record<string, unknown> = {
      owner_user_id: user.id,
      title,
      status: "active",
    };
    if (typeof body.key_signature === "string") insert.key_signature = body.key_signature;
    if (typeof body.tempo_bpm === "number") insert.tempo_bpm = body.tempo_bpm;
    if (typeof body.time_signature === "string") insert.time_signature = body.time_signature;
    if (typeof body.cover_color === "string") insert.cover_color = body.cover_color;
    if (Array.isArray(body.tags)) insert.tags = body.tags.filter((t: unknown) => typeof t === "string").slice(0, 24);

    const { data: song, error: insErr } = await admin
      .from("songs")
      .insert(insert)
      .select("*")
      .maybeSingle();
    if (insErr || !song) return jsonResponse({ error: insErr?.message ?? "insert_failed" }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "create_song",
      entity_type: "song",
      entity_id: song.id,
      after: song,
    });

    return jsonResponse({ song });
  } catch (e) {
    console.error("create-song error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
