import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || token.length < 8) return jsonResponse({ error: "invalid_token" }, 400);

    const admin = adminClient();
    const { data: invite } = await admin
      .from("song_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return jsonResponse({ error: "not_found" }, 404);

    const { data: valid } = await admin.rpc("is_invite_valid", { _invite_id: invite.id });
    if (!valid) return jsonResponse({ error: "invite_invalid_or_expired" }, 410);

    // Already a member? Idempotent success.
    const { data: existing } = await admin
      .from("song_members")
      .select("id, role")
      .eq("song_id", invite.song_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      return jsonResponse({ ok: true, song_id: invite.song_id, role: existing.role, already_member: true });
    }

    const { error: memErr } = await admin.from("song_members").insert({
      song_id: invite.song_id,
      user_id: user.id,
      role: invite.role,
      invited_by_user_id: invite.created_by_user_id,
    });
    if (memErr) return jsonResponse({ error: memErr.message }, 500);

    const newUseCount = (invite.use_count ?? 0) + 1;
    const exhausted = newUseCount >= invite.max_uses;
    const { error: updErr } = await admin
      .from("song_invites")
      .update({
        use_count: newUseCount,
        status: exhausted ? "accepted" : "pending",
        accepted_by_user_id: exhausted ? user.id : invite.accepted_by_user_id,
        accepted_at: exhausted ? new Date().toISOString() : invite.accepted_at,
      })
      .eq("id", invite.id);
    if (updErr) console.warn("invite update failed", updErr.message);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "accept_invite",
      entity_type: "song_invite",
      entity_id: invite.id,
      after: { song_id: invite.song_id, role: invite.role },
    });

    return jsonResponse({ ok: true, song_id: invite.song_id, role: invite.role });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
