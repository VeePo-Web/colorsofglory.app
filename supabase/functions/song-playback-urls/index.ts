/**
 * song-playback-urls — ONE signed-URL request for an entire song room.
 *
 * Playback in the room previously cost one edge-function invocation per card,
 * paid at the moment the user tapped play. That is a cold round trip standing
 * between a thumb and a sound — the single most latency-sensitive interaction
 * in the product. This signs every take/memo in the song in one call so the
 * room can prewarm its whole audio map on entry and every tap plays instantly.
 *
 * Membership-gated once, for the song, instead of once per memo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TTL_SECONDS = 900;

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

    const { song_id, memo_ids } = await req.json().catch(() => ({}));
    if (!song_id) return jsonResponse({ error: "song_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await admin.rpc("is_song_member", {
      _song_id: song_id,
      _user_id: userId,
    });
    if (!isMember) return jsonResponse({ error: "Forbidden" }, 403);

    let memoQuery = admin
      .from("voice_memos")
      .select("id, storage_path")
      .eq("song_id", song_id)
      .neq("status", "deleted");
    if (Array.isArray(memo_ids) && memo_ids.length > 0) {
      memoQuery = memoQuery.in("id", memo_ids);
    }
    const { data: memos, error: memoErr } = await memoQuery;
    if (memoErr) return jsonResponse({ error: memoErr.message }, 500);

    const { data: takes } = await admin
      .from("takes")
      .select("id, storage_path")
      .eq("song_id", song_id)
      .eq("is_archived", false);

    const entries: { key: string; path: string }[] = [
      ...(memos ?? []).map((m) => ({ key: m.id as string, path: m.storage_path as string })),
      ...(takes ?? []).map((t) => ({ key: t.id as string, path: t.storage_path as string })),
    ].filter((e) => Boolean(e.path));

    if (entries.length === 0) {
      return jsonResponse({ urls: {}, expires_in: TTL_SECONDS, count: 0 });
    }

    // De-duplicate paths: a take and its memo can point at the same object.
    const uniquePaths = [...new Set(entries.map((e) => e.path))];
    const { data: signed, error: sErr } = await admin.storage
      .from("voice-memos")
      .createSignedUrls(uniquePaths, TTL_SECONDS);
    if (sErr) return jsonResponse({ error: sErr.message }, 500);

    const byPath = new Map<string, string>();
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) byPath.set(row.path, row.signedUrl);
    }

    const urls: Record<string, string> = {};
    for (const entry of entries) {
      const url = byPath.get(entry.path);
      if (url) urls[entry.key] = url;
    }

    return jsonResponse({ urls, expires_in: TTL_SECONDS, count: Object.keys(urls).length });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
