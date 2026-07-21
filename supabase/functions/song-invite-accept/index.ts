import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";
import { logActivity } from "../_shared/activity.ts";
import { sendViaResend, COG_SENDERS } from "../_shared/resend.ts";
import { inviteAcceptedEmail } from "../_shared/email.ts";

// C3 · collab.invite_accepted — tell the inviter someone stepped into the
// room (docs/email/COG-EMAIL-SYSTEM.md §5). Transactional, instant, and
// STRICTLY NON-FATAL: acceptance already succeeded; mail must never break it.
// deno-lint-ignore no-explicit-any
async function notifyInviter(admin: any, token: string, songId: string, inviteeUserId: string) {
  try {
    const { data: invite } = await admin
      .from("song_invites")
      .select("created_by_user_id, role")
      .eq("token", token)
      .maybeSingle();
    const inviterId = invite?.created_by_user_id;
    if (!inviterId || inviterId === inviteeUserId) return;

    const [{ data: inviter }, { data: invitee }, { data: song }] = await Promise.all([
      admin.from("profiles").select("email").eq("user_id", inviterId).maybeSingle(),
      admin.from("profiles").select("display_name, first_name").eq("user_id", inviteeUserId).maybeSingle(),
      admin.from("songs").select("title").eq("id", songId).maybeSingle(),
    ]);
    if (!inviter?.email) return; // no email on profile → skip, never block

    const template = inviteAcceptedEmail({
      inviteeName: invitee?.display_name?.trim() || invitee?.first_name?.trim() || "Your collaborator",
      songTitle: song?.title ?? "your song",
      songId,
      role: invite?.role ?? "collaborator",
    });
    await sendViaResend({
      from: COG_SENDERS.primary,
      to: inviter.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [
        { name: "app", value: "cog" },
        { name: "category", value: "collab" },
        { name: "kind", value: "collab_invite_accepted" },
      ],
    });
  } catch (e) {
    console.error("[song-invite-accept] accepted_email_failed", String(e));
  }
}

// Maps SQL helper codes -> HTTP status
const STATUS: Record<string, number> = {
  OK: 200,
  UNAUTHENTICATED: 401,
  INVITE_NOT_FOUND: 404,
  INVITE_ALREADY_USED: 410,
  INVITE_EXPIRED: 410,
  INVITE_EXHAUSTED: 410,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ ok: false, code: "UNAUTHENTICATED", message: "Sign in required" }, 401);

    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || token.length < 8) {
      return jsonResponse({ ok: false, code: "INVALID_INPUT", message: "Invite token required" }, 400);
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc("accept_song_invite", { _token: token, _user_id: user.id });
    if (error) return jsonResponse({ ok: false, code: "INTERNAL", message: error.message }, 500);

    const row = Array.isArray(data) ? data[0] : data;
    const code = row?.code ?? "INTERNAL";
    if (code === "OK") {
      if (row.song_id && !row.already_member) {
        await logActivity(admin, {
          song_id: row.song_id,
          actor_user_id: user.id,
          kind: "invite_accepted",
          entity_type: "song_member",
          entity_id: user.id,
          payload: { role: row.role },
        });
        await notifyInviter(admin, token, row.song_id, user.id);
      }
      return jsonResponse(
        {
          ok: true,
          code,
          data: {
            song_id: row.song_id,
            role: row.role,
            already_member: row.already_member === true,
          },
        },
        200,
      );
    }
    return jsonResponse({ ok: false, code, message: code }, STATUS[code] ?? 400);
  } catch (e) {
    return jsonResponse({ ok: false, code: "INTERNAL", message: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
