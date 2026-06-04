import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({
  invoice_id: z.string().trim().min(1).max(200).optional(),
  referrer_user_id: z.string().uuid().optional(),
  referred_user_id: z.string().uuid().optional(),
  reversed_reason: z.string().trim().min(1).max(100).optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entity_type: z.string().trim().min(1).max(100).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = Body.safeParse(raw ?? {});
  if (!parsed.success) {
    return json({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const f = parsed.data;

  const { data, error } = await supabase.rpc("admin_search_audit_logs", {
    _invoice_id: f.invoice_id ?? null,
    _referrer_user_id: f.referrer_user_id ?? null,
    _referred_user_id: f.referred_user_id ?? null,
    _reversed_reason: f.reversed_reason ?? null,
    _action: f.action ?? null,
    _entity_type: f.entity_type ?? null,
    _since: f.since ?? null,
    _until: f.until ?? null,
    _limit: f.limit ?? 50,
    _offset: f.offset ?? 0,
  });

  if (error) {
    const status = (error as { code?: string }).code === "42501" ? 403 : 500;
    return json({ error: error.message }, status);
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { total_count: number }>;
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
  const limit = f.limit ?? 50;
  const offset = f.offset ?? 0;

  return json({
    rows: rows.map(({ total_count: _t, ...rest }) => rest),
    total,
    has_more: offset + rows.length < total,
    limit,
    offset,
  });
});
