import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

const STATUS: Record<string, number> = {
  OK: 200,
  UNAUTHENTICATED: 401,
  NOT_A_MEMBER: 404,
  OWNER_CANNOT_LEAVE: 409,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" }, 405);
  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ ok: false, code: "UNAUTHENTICATED", message: "Sign in required" }, 401);
    const { song_id } = await req.json().catch(() => ({}));
    if (typeof song_id !== "string") return jsonResponse({ ok: false, code: "INVALID_INPUT", message: "song_id required" }, 400);

    const admin = adminClient();
    const { data, error } = await admin.rpc("safe_leave_song", { _song_id: song_id, _user_id: user.id });
    if (error) return jsonResponse({ ok: false, code: "INTERNAL", message: error.message }, 500);
    const code = (data as string) ?? "INTERNAL";
    if (code === "OK") return jsonResponse({ ok: true, code }, 200);
    return jsonResponse({ ok: false, code, message: code }, STATUS[code] ?? 400);
  } catch (e) {
    return jsonResponse({ ok: false, code: "INTERNAL", message: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
