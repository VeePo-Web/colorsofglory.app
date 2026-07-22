import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = /^audio\//;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller using their JWT against the anon client.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);
    const userId = userData.user.id;

    // Parse multipart form.
    const form = await req.formData();
    const file = form.get("audio");
    const songId = String(form.get("song_id") ?? "");
    const title = form.get("title") ? String(form.get("title")) : null;

    if (!(file instanceof File) && !(file instanceof Blob)) {
      return json({ error: "audio file required" }, 400);
    }
    if (!songId) return json({ error: "song_id required" }, 400);

    const mime = (file as File).type || "audio/webm";
    if (!ALLOWED_MIME.test(mime)) {
      return json({ error: "audio/* mime required" }, 400);
    }
    const size = (file as File).size ?? 0;
    if (size === 0) return json({ error: "empty file" }, 400);
    if (size > MAX_BYTES) return json({ error: "file too large (max 50 MB)" }, 400);

    // Use service role for membership check + insert; we already verified the user.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isMember, error: memberErr } = await admin.rpc("is_song_member", {
      _song_id: songId,
      _user_id: userId,
    });
    if (memberErr) return json({ error: memberErr.message }, 500);
    if (!isMember) return json({ error: "not a member of this song" }, 403);

    // Storage path: <song_id>/<user_id>/shared/<uuid>.<ext>
    const ext = mimeToExt(mime);
    const memoId = crypto.randomUUID();
    const storagePath = `${songId}/${userId}/shared/${memoId}.${ext}`;

    const arrayBuf = await (file as Blob).arrayBuffer();
    const { error: upErr } = await admin.storage
      .from("voice-memos")
      .upload(storagePath, arrayBuf, { contentType: mime, upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    // Insert voice memo.
    const { data: memo, error: memoErr } = await admin
      .from("voice_memos")
      .insert({
        id: memoId,
        song_id: songId,
        author_user_id: userId,
        storage_path: storagePath,
        mime_type: mime,
        byte_size: size,
        title,
        status: "ready",
      })
      .select("id")
      .single();
    if (memoErr) return json({ error: memoErr.message }, 500);

    // Primary take (the backfill trigger doesn't fire on new memos automatically, so insert explicitly).
    const { error: takeErr } = await admin.from("takes").insert({
      voice_memo_id: memo.id,
      song_id: songId,
      created_by: userId,
      storage_path: storagePath,
      mime_type: mime,
      byte_size: size,
      is_primary: true,
    });
    if (takeErr) return json({ error: takeErr.message }, 500);

    // Fire-and-forget feature usage marker (never blocks the intake).
    admin
      .from("feature_usage")
      .upsert({ user_id: userId, feature: "voice_memo" }, { onConflict: "user_id,feature" })
      .then(({ error }) => { if (error) console.warn("feature_usage insert failed", error.message); });

    return json({ voice_memo_id: memo.id, song_id: songId }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mimeToExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("aac")) return "aac";
  return "bin";
}