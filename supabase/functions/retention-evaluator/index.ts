import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueEmail } from "../_shared/emailGovernance.ts";

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profiles } = await admin.from("profiles").select("user_id").limit(5000);
  let enqueued = 0;
  for (const p of profiles ?? []) {
    const { data: d } = await admin.rpc("dormancy", { _user_id: p.user_id });
    const row = Array.isArray(d) ? d[0] : d;
    if (!row) continue;
    const days = row.days_inactive ?? 0;
    let kind: string | null = null;
    if (days >= 45) kind = "retain.gentle_return";
    else if (days >= 21 && row.has_unfinished_song) kind = "retain.stalled_song";
    else if (days >= 14 && row.collaborator_waiting) kind = "retain.collab_waiting";
    if (!kind) continue;
    await enqueueEmail(admin, {
      user_id: p.user_id, kind, category: "retain",
      dedupe_key: `${kind}:${p.user_id}:${new Date().toISOString().slice(0,10)}`,
    });
    enqueued++;
  }
  return new Response(JSON.stringify({ ok: true, enqueued }), {
    headers: { "Content-Type": "application/json" },
  });
});