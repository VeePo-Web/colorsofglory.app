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
    const { data: member } = await admin
      .from("song_members")
      .select("id, role")
      .eq("song_id", song_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return jsonResponse({ error: "not_a_member" }, 404);
    if (member.role === "owner") {
      return jsonResponse({ error: "owner_cannot_leave", hint: "transfer ownership first" }, 409);
    }

    const { error: delErr } = await admin.from("song_members").delete().eq("id", member.id);
    if (delErr) return jsonResponse({ error: delErr.message }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "leave_song",
      entity_type: "song_member",
      entity_id: member.id,
      before: member,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
