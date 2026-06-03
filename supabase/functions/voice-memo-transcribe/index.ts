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

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Only accept calls bearing the service-role key (internal)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.includes(SERVICE_KEY)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { memo_id } = await req.json();
    if (!memo_id) return jsonResponse({ error: "memo_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: memo, error: memoErr } = await admin
      .from("voice_memos")
      .select("id, song_id, storage_path, mime_type")
      .eq("id", memo_id)
      .maybeSingle();
    if (memoErr || !memo) return jsonResponse({ error: "Memo not found" }, 404);

    // Atomically claim the row (sets status=processing, attempts++)
    const { data: claimRows, error: claimErr } = await admin.rpc("claim_transcript_attempt", {
      _memo_id: memo_id,
    });
    if (claimErr) return jsonResponse({ error: claimErr.message }, 500);
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim) {
      // Nothing to do: already ready, in flight, or exhausted
      return jsonResponse({ memo_id, status: "skipped" });
    }
    const attempt: number = claim.attempt_count;
    const maxAttempts: number = claim.max_attempts;

    await admin
      .from("voice_memo_transcripts")
      .update({ model: MODEL })
      .eq("memo_id", memo_id);

    try {
      const { data: file, error: dlErr } = await admin.storage
        .from("voice-memos")
        .download(memo.storage_path);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "Download failed");

      const base64 = await blobToBase64(file);
      const dataUrl = `data:${memo.mime_type};base64,${base64}`;

      const aiResp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a transcription assistant for a songwriting app. Transcribe the audio verbatim. If the audio contains humming, melodies without words, or instrumentation, describe it briefly in [brackets]. Output only the transcript text, no preamble.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe this voice memo." },
                { type: "input_audio", input_audio: { data: base64, format: memo.mime_type.split("/")[1] ?? "webm" } },
              ],
            },
          ],
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        throw new Error(`AI gateway ${aiResp.status}: ${errText}`);
      }
      const aiJson = await aiResp.json();
      const text: string = aiJson.choices?.[0]?.message?.content ?? "";

      await admin
        .from("voice_memo_transcripts")
        .update({
          status: "ready",
          text,
          segments: [],
          model: MODEL,
          error: null,
          last_error: null,
        })
        .eq("memo_id", memo_id);

      // Flip the memo lifecycle to 'transcribed'
      await admin.rpc("mark_memo_transcribed", { _memo_id: memo_id });

      return jsonResponse({ memo_id, status: "ready", chars: text.length, attempt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Exponential backoff: 60s * 2^attempt, capped at 30min, with ±20% jitter
      const baseMs = Math.min(60_000 * Math.pow(2, attempt), 30 * 60_000);
      const jitter = baseMs * (0.8 + Math.random() * 0.4);
      const nextAt = new Date(Date.now() + jitter).toISOString();
      const exhausted = attempt >= maxAttempts;
      await admin
        .from("voice_memo_transcripts")
        .update({
          status: "failed",
          error: msg,
          last_error: msg,
          next_attempt_at: exhausted ? new Date(Date.now() + 365 * 24 * 3600_000).toISOString() : nextAt,
        })
        .eq("memo_id", memo_id);
      return jsonResponse({
        memo_id,
        status: "failed",
        error: msg,
        attempt,
        will_retry: !exhausted,
        next_attempt_at: exhausted ? null : nextAt,
      }, 500);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});