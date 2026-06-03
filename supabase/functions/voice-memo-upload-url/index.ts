import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);
const MAX_BYTES = 50 * 1024 * 1024;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { song_id, section_id, mime_type, byte_size, duration_ms, title } = body ?? {};
    if (!song_id || typeof song_id !== "string") return jsonResponse({ error: "song_id required" }, 400);
    if (!mime_type || !ALLOWED_MIME.has(mime_type)) return jsonResponse({ error: "Unsupported mime_type" }, 400);
    if (!Number.isFinite(byte_size) || byte_size <= 0 || byte_size > MAX_BYTES) {
      return jsonResponse({ error: "Invalid byte_size (max 50MB)" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Membership check
    const { data: isMember, error: memErr } = await admin.rpc("is_song_member", {
      _song_id: song_id,
      _user_id: userId,
    });
    if (memErr) return jsonResponse({ error: memErr.message }, 500);
    if (!isMember) return jsonResponse({ error: "Forbidden" }, 403);

    // Get owner
    const { data: song, error: songErr } = await admin
      .from("songs")
      .select("owner_user_id")
      .eq("id", song_id)
      .maybeSingle();
    if (songErr || !song) return jsonResponse({ error: "Song not found" }, 404);
    const ownerId = song.owner_user_id;

    // Quota check (per owner)
    const { data: usage } = await admin
      .from("storage_usage")
      .select("bytes_used")
      .eq("user_id", ownerId)
      .maybeSingle();
    const { data: limitData, error: limitErr } = await admin.rpc("effective_storage_limit", { _user_id: ownerId });
    if (limitErr) return jsonResponse({ error: limitErr.message }, 500);
    const used = Number(usage?.bytes_used ?? 0);
    const limit = Number(limitData ?? 0);
    if (used + byte_size > limit) {
      return jsonResponse(
        { error: "Storage limit exceeded", used, limit, requested: byte_size },
        413,
      );
    }

    // Determine extension from mime
    const ext = mime_type === "audio/mpeg"
      ? "mp3"
      : mime_type === "audio/wav" || mime_type === "audio/x-wav"
      ? "wav"
      : mime_type === "audio/mp4"
      ? "m4a"
      : mime_type === "audio/ogg"
      ? "ogg"
      : "webm";

    // Create memo row first (status=uploading)
    const memoId = crypto.randomUUID();
    const storagePath = `${ownerId}/${song_id}/${memoId}.${ext}`;

    const { error: insErr } = await admin.from("voice_memos").insert({
      id: memoId,
      song_id,
      section_id: section_id ?? null,
      author_user_id: userId,
      storage_path: storagePath,
      mime_type,
      byte_size,
      duration_ms: duration_ms ?? null,
      title: title ?? null,
      status: "uploading",
    });
    if (insErr) return jsonResponse({ error: insErr.message }, 500);

    // Signed upload URL
    const { data: signed, error: signedErr } = await admin.storage
      .from("voice-memos")
      .createSignedUploadUrl(storagePath);
    if (signedErr || !signed) {
      await admin.from("voice_memos").delete().eq("id", memoId);
      return jsonResponse({ error: signedErr?.message ?? "Failed to create upload URL" }, 500);
    }

    return jsonResponse({
      memo_id: memoId,
      storage_path: storagePath,
      upload_url: signed.signedUrl,
      token: signed.token,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});