import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Weekly rhythm evaluator — placeholder. The D-programs (digest.what_changed,
// digest.your_week, growth.invite_nudge) are evaluated by the daily
// email-lifecycle-evaluator. This function exists to keep the legacy cron
// entry from 404-ing while the data spine is migrated; it returns immediately.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ ok: true, note: "evaluator merged into email-lifecycle-evaluator" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
