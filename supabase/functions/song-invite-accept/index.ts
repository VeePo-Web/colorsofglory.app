import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

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
      return jsonResponse({ ok: true, code, data: { song_id: row.song_id, role: row.role } }, 200);
    }
    return jsonResponse({ ok: false, code, message: code }, STATUS[code] ?? 400);
  } catch (e) {
    return jsonResponse({ ok: false, code: "INTERNAL", message: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
