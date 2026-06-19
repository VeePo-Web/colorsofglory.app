import { adminClient, corsHeaders, getEnvOrThrow, jsonResponse, resolveUser } from "../_shared/auth.ts";

// PRIVACY FENCE: only these field names may be sent to the LLM. Lyric, memo,
// transcript, scripture, capture title etc. are NEVER allowed in the prompt.
const ALLOWED_PROMPT_FIELDS = new Set([
  "kind", "actor_name", "event_count", "last_at",
]);

type DigestRow = {
  kind: string;
  actor_user_id: string | null;
  event_count: number;
  last_at: string;
  sample_entity_ids: string[] | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const user = await resolveUser(req);
  if (!user) return jsonResponse({ error: "unauthenticated" }, 401);

  let body: { song_id?: string; since?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!body.song_id) return jsonResponse({ error: "missing_song_id" }, 400);
  const since = body.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const admin = adminClient();

  // Membership gate via existing RPC (raises if not a member)
  const { data: rows, error } = await admin.rpc("list_song_activity_since", {
    _song_id: body.song_id,
    _since: since,
    _limit: 200,
  });
  if (error) return jsonResponse({ error: "db_error", detail: error.message }, 500);

  const digestRows = (rows ?? []) as DigestRow[];
  if (digestRows.length === 0) {
    return jsonResponse({ digest: "No new activity.", rows: [] });
  }

  // Resolve actor names — IDs in, display names out, nothing else.
  const actorIds = Array.from(
    new Set(digestRows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
  );
  const { data: profs } = await admin
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", actorIds);
  const nameMap = new Map<string, string>(
    (profs ?? []).map((p: { user_id: string; display_name: string | null }) => [
      p.user_id,
      p.display_name ?? "Someone",
    ]),
  );

  // Build the sanitized prompt payload — strictly allow-listed fields.
  const sanitized = digestRows.map((r) => {
    const item: Record<string, unknown> = {
      kind: r.kind,
      actor_name: r.actor_user_id ? nameMap.get(r.actor_user_id) ?? "Someone" : "Someone",
      event_count: r.event_count,
      last_at: r.last_at,
    };
    for (const k of Object.keys(item)) {
      if (!ALLOWED_PROMPT_FIELDS.has(k)) {
        throw new Error(`prompt_fence_violation:${k}`);
      }
    }
    return item;
  });

  const prompt = [
    "Write one short, warm paragraph (max 2 sentences) summarizing recent activity in a songwriting room.",
    "Use the people's names. Mention kinds of actions in plain language. Do NOT invent any content, lyrics, or quotes.",
    "Input JSON:",
    JSON.stringify(sanitized),
  ].join("\n");

  let digest = "Recent changes in this song room.";
  try {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getEnvOrThrow("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write brief, warm recap sentences. Never invent lyric content." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (aiRes.ok) {
      const json = await aiRes.json();
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) digest = text.trim();
    } else {
      console.warn("ai_gateway_non_ok", aiRes.status, await aiRes.text());
    }
  } catch (e) {
    console.warn("ai_gateway_error", (e as Error)?.message);
  }

  return jsonResponse({ digest, rows: digestRows });
});