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

    const { memo_id, actual_byte_size, duration_ms, waveform_peaks } = await req.json();
    if (!memo_id || typeof memo_id !== "string") return jsonResponse({ error: "memo_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: memo, error: memoErr } = await admin
      .from("voice_memos")
      .select("id, song_id, author_user_id, storage_path, byte_size, status")
      .eq("id", memo_id)
      .maybeSingle();
    if (memoErr || !memo) return jsonResponse({ error: "Memo not found" }, 404);

    // Caller must be author or song owner
    const { data: isOwner } = await admin.rpc("is_song_owner", {
      _song_id: memo.song_id,
      _user_id: userId,
    });
    if (memo.author_user_id !== userId && !isOwner) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // Verify object exists
    const { data: head, error: headErr } = await admin.storage
      .from("voice-memos")
      .list(memo.storage_path.substring(0, memo.storage_path.lastIndexOf("/")), {
        search: memo.storage_path.split("/").pop(),
        limit: 1,
      });
    if (headErr) return jsonResponse({ error: headErr.message }, 500);
    const fileEntry = head?.[0];
    if (!fileEntry) {
      await admin.from("voice_memos").update({ status: "failed" }).eq("id", memo_id);
      return jsonResponse({ error: "Upload not found in storage" }, 404);
    }

    const realSize = Number(fileEntry.metadata?.size ?? actual_byte_size ?? memo.byte_size);

    const update: Record<string, unknown> = {
      status: "finalized",
      byte_size: realSize,
    };
    if (duration_ms != null) update.duration_ms = duration_ms;
    if (waveform_peaks != null) update.waveform_peaks = waveform_peaks;

    const { error: updErr } = await admin.from("voice_memos").update(update).eq("id", memo_id);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);

    // Enqueue transcript row
    await admin.from("voice_memo_transcripts").upsert(
      {
        memo_id,
        song_id: memo.song_id,
        status: "pending",
        attempt_count: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
        error: null,
      },
      { onConflict: "memo_id" },
    );

    // Fire and forget transcribe
    const transcribeUrl = `${SUPABASE_URL}/functions/v1/voice-memo-transcribe`;
    fetch(transcribeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ memo_id }),
    }).catch((e) => console.error("transcribe dispatch error", e));

    // A3 · onboarding.first_capture_win — the first idea a user ever lands
    // is worth a warm word (docs/email/COG-EMAIL-SYSTEM.md §5). Once ever
    // (DB dedupe); quiet hours defer it to morning at the drain. Non-fatal.
    try {
      const { enqueueEmail } = await import("../_shared/emailGovernance.ts");
      const { data: song } = await admin
        .from("songs")
        .select("title")
        .eq("id", memo.song_id)
        .maybeSingle();
      await enqueueEmail(admin, {
        user_id: memo.author_user_id,
        kind: "onboarding.first_capture_win",
        category: "onboarding",
        payload: { song_id: memo.song_id, song_title: song?.title ?? "your song" },
        dedupe_key: `onboarding.first_capture_win:${memo.author_user_id}`,
      });
    } catch (e) {
      console.error("[voice-memo-finalize] capture_win_enqueue_failed", String(e));
    }

    return jsonResponse({ memo_id, status: "finalized", byte_size: realSize });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});