// Weekly rhythm: enqueues one of {weekly.your_week, growth.invite_nudge} per
// eligible user on their Sunday 6pm local. Digest is D1 handled by the
// lifecycle-evaluator; this one covers §8.4/§8.5 rhythm nudges.

import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueEmail } from "../_shared/emailGovernance.ts";

function isSundayEvening(tz: string | null): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "America/Denver",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const wd = fmt.find((p) => p.type === "weekday")?.value;
    const hr = parseInt(fmt.find((p) => p.type === "hour")?.value || "0", 10);
    return wd === "Sun" && hr === 18;
  } catch { return false; }
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dn = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((date.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const wk = isoWeek(new Date());
  let enqueued = 0, scanned = 0;

  const { data: profiles } = await admin
    .from("profiles").select("user_id, timezone").limit(5000);

  for (const p of profiles ?? []) {
    if (!isSundayEvening(p.timezone)) continue;
    scanned++;
    const { data: cs } = await admin.rpc("catalog_size", { _user_id: p.user_id });
    const catalog = Array.isArray(cs) ? cs[0] : cs;
    const total = (catalog?.owned_songs ?? 0) + (catalog?.member_songs ?? 0);
    if (total === 0) {
      await enqueueEmail(admin, {
        user_id: p.user_id, kind: "growth.invite_nudge", category: "growth",
        dedupe_key: `growth.invite_nudge:${p.user_id}:${wk}`,
      });
      enqueued++;
    } else {
      await enqueueEmail(admin, {
        user_id: p.user_id, kind: "weekly.your_week", category: "digest",
        dedupe_key: `weekly.your_week:${p.user_id}:${wk}`,
      });
      enqueued++;
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned, enqueued, week: wk }), {
    headers: { "Content-Type": "application/json" },
  });
});