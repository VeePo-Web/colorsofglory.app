import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getUTCFullYear());
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return new Response(JSON.stringify({ error: "invalid_year" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;

  // Founder id (may be null)
  const { data: founder } = await admin
    .from("founders").select("id").eq("user_id", user.id).maybeSingle();

  const orParts: string[] = [`referrer_user_id.eq.${user.id}`];
  if (founder?.id) orParts.push(`referrer_founder_id.eq.${founder.id}`);

  const { data: rows, error } = await admin
    .from("reward_events")
    .select("created_at, status, reward_kind, amount_cents, invoice_external_id, period_start, period_end, paid_month_index, payout_id")
    .or(orParts.join(","))
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: String(error.message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const header = [
    "created_at","status","reward_kind","amount_cents","invoice_external_id",
    "period_start","period_end","paid_month_index","payout_id",
  ];
  const lines = [header.join(",")];
  for (const r of rows ?? []) {
    lines.push(header.map((h) => csvEscape((r as any)[h])).join(","));
  }
  const csv = lines.join("\n") + "\n";

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cog-earnings-${year}.csv"`,
    },
  });
});