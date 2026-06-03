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

    const { memo_id } = await req.json();
    if (!memo_id) return jsonResponse({ error: "memo_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: memo, error: memoErr } = await admin
      .from("voice_memos")
      .select("song_id, storage_path, status")
      .eq("id", memo_id)
      .maybeSingle();
    if (memoErr || !memo) return jsonResponse({ error: "Memo not found" }, 404);

    const { data: isMember } = await admin.rpc("is_song_member", {
      _song_id: memo.song_id,
      _user_id: userId,
    });
    if (!isMember) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: signed, error: sErr } = await admin.storage
      .from("voice-memos")
      .createSignedUrl(memo.storage_path, 300);
    if (sErr || !signed) return jsonResponse({ error: sErr?.message ?? "Failed" }, 500);

    return jsonResponse({ url: signed.signedUrl, expires_in: 300 });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});