import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";
import { sendViaResend, COG_SENDERS } from "../_shared/resend.ts";
import { inviteEmail } from "../_shared/email.ts";
import { enqueueEmail } from "../_shared/emailGovernance.ts";

function genToken(len = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const song_id: string | undefined = body.song_id;
    if (typeof song_id !== "string") return jsonResponse({ error: "song_id_required" }, 400);
    const role: string = typeof body.role === "string" ? body.role : "collaborator";
    if (!["collaborator", "viewer"].includes(role)) return jsonResponse({ error: "invalid_role" }, 400);
    const invited_email: string | null = typeof body.invited_email === "string" ? body.invited_email.toLowerCase().trim() : null;
    const invited_phone: string | null = typeof body.invited_phone === "string" ? body.invited_phone.trim() : null;
    const message: string | null = typeof body.message === "string" ? body.message.slice(0, 500) : null;
    const max_uses: number = Number.isInteger(body.max_uses) && body.max_uses > 0 && body.max_uses <= 50 ? body.max_uses : 1;

    const admin = adminClient();
    const { data: allowed, error: gErr } = await admin.rpc("can_invite", { _song_id: song_id, _user_id: user.id });
    if (gErr) return jsonResponse({ error: gErr.message }, 500);
    if (!allowed) return jsonResponse({ error: "forbidden" }, 403);

    const token = genToken(24);
    const { data: invite, error: insErr } = await admin
      .from("song_invites")
      .insert({
        song_id,
        token,
        invited_email,
        invited_phone,
        role,
        status: "pending",
        created_by_user_id: user.id,
        max_uses,
        message,
      })
      .select("*")
      .maybeSingle();
    if (insErr || !invite) return jsonResponse({ error: insErr?.message ?? "insert_failed" }, 500);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "create_invite",
      entity_type: "song_invite",
      entity_id: invite.id,
      after: { song_id, role, max_uses },
    });

    // C1 · collab.invite — the most important growth email in the system
    // (docs/email/COG-EMAIL-SYSTEM.md §4/§5). Transactional-warm, instant,
    // sent only when the inviter addressed a real email. STRICTLY NON-FATAL:
    // the invite row is already created and returned; a mail hiccup must
    // never break inviting. Also enqueues the one C2 reminder (+3 days),
    // deduped per invite — the drain re-checks the invite is still pending.
    if (invited_email) {
      try {
        const [{ data: song }, { data: inviterProfile }] = await Promise.all([
          admin.from("songs").select("title").eq("id", song_id).maybeSingle(),
          admin.from("profiles").select("display_name, first_name").eq("user_id", user.id).maybeSingle(),
        ]);
        const inviterName =
          inviterProfile?.display_name?.trim() ||
          inviterProfile?.first_name?.trim() ||
          "A songwriter";
        const songTitle = song?.title ?? "a song";

        const template = inviteEmail({
          inviterName,
          songTitle,
          role,
          personalNote: message,
          token,
        });
        await sendViaResend({
          from: COG_SENDERS.primary,
          to: invited_email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          tags: [
            { name: "app", value: "cog" },
            { name: "category", value: "collab" },
            { name: "kind", value: "collab_invite" },
          ],
        }).catch((e) => console.error("[song-invite-create] invite_email_failed", String(e)));

        await enqueueEmail(admin, {
          user_id: user.id, // queue owner; the drain sends to payload/invite email
          kind: "collab.invite_reminder",
          category: "collab",
          payload: { invite_id: invite.id, inviter_name: inviterName, song_title: songTitle },
          scheduled_for: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          dedupe_key: `collab.invite_reminder:${invite.id}`,
        });
      } catch (e) {
        console.error("[song-invite-create] email_wiring_failed", String(e));
      }
    }

    return jsonResponse({ invite });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
