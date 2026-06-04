import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" }, 405);
  }

  try {
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || token.length < 8) {
      return jsonResponse({ ok: false, code: "INVALID_INPUT", message: "Invite token required" }, 400);
    }

    const admin = adminClient();

    const { data: invite, error: invErr } = await admin
      .from("song_invites")
      .select("id, song_id, role, status, expires_at, use_count, max_uses, created_by_user_id")
      .eq("token", token)
      .maybeSingle();

    if (invErr) {
      return jsonResponse({ ok: false, code: "INTERNAL", message: invErr.message }, 500);
    }
    if (!invite) {
      return jsonResponse({ ok: false, code: "INVITE_NOT_FOUND", message: "Invite not found" }, 404);
    }

    const now = Date.now();
    if (invite.status === "revoked") {
      return jsonResponse({ ok: false, code: "INVITE_REVOKED", message: "Invite revoked" }, 410);
    }
    if (invite.status === "expired" || new Date(invite.expires_at).getTime() <= now) {
      return jsonResponse({ ok: false, code: "INVITE_EXPIRED", message: "Invite expired" }, 410);
    }
    if (invite.status === "accepted" || invite.use_count >= invite.max_uses) {
      // Still return preview metadata so an already-accepted user can be guided in.
      // Membership check happens at /accept; here we just flag it.
    }

    const [{ data: song }, { data: inviter }, { count: collaboratorCount }] = await Promise.all([
      admin.from("songs").select("title").eq("id", invite.song_id).maybeSingle(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", invite.created_by_user_id)
        .maybeSingle(),
      admin
        .from("song_members")
        .select("user_id", { count: "exact", head: true })
        .eq("song_id", invite.song_id),
    ]);

    return jsonResponse(
      {
        ok: true,
        code: "OK",
        data: {
          song_id: invite.song_id,
          song_title: song?.title ?? "Untitled song",
          inviter_name: inviter?.display_name ?? "A collaborator",
          role: invite.role,
          collaborator_count: collaboratorCount ?? 0,
          expires_at: invite.expires_at,
          uses_remaining: Math.max(0, (invite.max_uses ?? 0) - (invite.use_count ?? 0)),
        },
      },
      200,
    );
  } catch (e) {
    return jsonResponse(
      { ok: false, code: "INTERNAL", message: e instanceof Error ? e.message : "unknown" },
      500,
    );
  }
});