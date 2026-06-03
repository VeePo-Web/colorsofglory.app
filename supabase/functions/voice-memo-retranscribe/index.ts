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
      .select("id, song_id, author_user_id")
      .eq("id", memo_id)
      .maybeSingle();
    if (memoErr || !memo) return jsonResponse({ error: "Memo not found" }, 404);

    const { data: isOwner } = await admin.rpc("is_song_owner", {
      _song_id: memo.song_id,
      _user_id: userId,
    });
    if (memo.author_user_id !== userId && !isOwner) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    await admin.rpc("reset_transcript_attempts", { _memo_id: memo_id });

    // Fire-and-forget immediate run
    fetch(`${SUPABASE_URL}/functions/v1/voice-memo-transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ memo_id }),
    }).catch((e) => console.error("retranscribe dispatch error", e));

    return jsonResponse({ memo_id, status: "queued" });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});