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

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Accept either the service-role key or the project anon key (pg_cron uses the
    // anon key in the apikey header to invoke functions on this project).
    const auth = req.headers.get("Authorization") ?? "";
    const apikey = req.headers.get("apikey") ?? "";
    const authorized =
      auth.includes(SERVICE_KEY) ||
      auth.includes(ANON_KEY) ||
      apikey === SERVICE_KEY ||
      apikey === ANON_KEY;
    if (!authorized) return jsonResponse({ error: "Forbidden" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: due, error: dueErr } = await admin
      .from("voice_memo_transcripts")
      .select("memo_id, status, attempt_count, max_attempts, next_attempt_at")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (dueErr) return jsonResponse({ error: dueErr.message }, 500);
    const items = (due ?? []).filter((r) => r.attempt_count < r.max_attempts);
    if (items.length === 0) return jsonResponse({ picked: 0 });

    const transcribeUrl = `${SUPABASE_URL}/functions/v1/voice-memo-transcribe`;

    // Concurrency-capped invocation
    let cursor = 0;
    const results: Array<{ memo_id: string; ok: boolean; error?: string }> = [];
    async function worker() {
      while (cursor < items.length) {
        const idx = cursor++;
        const memoId = items[idx].memo_id;
        try {
          const resp = await fetch(transcribeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ memo_id: memoId }),
          });
          results.push({ memo_id: memoId, ok: resp.ok });
        } catch (e) {
          results.push({
            memo_id: memoId,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

    return jsonResponse({
      picked: items.length,
      results,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});