import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const { song_id, new_owner_user_id } = await req.json().catch(() => ({}));
    if (typeof song_id !== "string" || typeof new_owner_user_id !== "string") {
      return jsonResponse({ error: "invalid_input" }, 400);
    }
    if (new_owner_user_id === user.id) return jsonResponse({ error: "already_owner" }, 409);

    const admin = adminClient();
    const { data: song } = await admin.from("songs").select("id, owner_user_id").eq("id", song_id).maybeSingle();
    if (!song) return jsonResponse({ error: "not_found" }, 404);
    if (song.owner_user_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);

    // Recipient must be quota-eligible (will own this song after transfer).
    const { data: allowed } = await admin.rpc("can_create_song", { _user_id: new_owner_user_id });
    if (!allowed) return jsonResponse({ error: "recipient_song_limit_reached" }, 402);

    // Recipient must already be a member (so we don't surprise-add them).
    const { data: recipientMember } = await admin
      .from("song_members")
      .select("id, role")
      .eq("song_id", song_id)
      .eq("user_id", new_owner_user_id)
      .maybeSingle();
    if (!recipientMember) return jsonResponse({ error: "recipient_not_member" }, 409);

    // Promote recipient, demote previous owner, flip songs.owner_user_id.
    const updates = await Promise.all([
      admin.from("song_members").update({ role: "owner" }).eq("id", recipientMember.id),
      admin.from("song_members").update({ role: "collaborator" }).eq("song_id", song_id).eq("user_id", user.id),
      admin.from("songs").update({ owner_user_id: new_owner_user_id, updated_at: new Date().toISOString() }).eq("id", song_id),
    ]);
    for (const r of updates) if (r.error) return jsonResponse({ error: r.error.message }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "transfer_owner",
      entity_type: "song",
      entity_id: song_id,
      before: { owner_user_id: user.id },
      after: { owner_user_id: new_owner_user_id },
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
