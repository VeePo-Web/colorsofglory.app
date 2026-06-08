import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const BodySchema = z.object({
  reference: z.string().trim().min(1).max(120),
  translation: z.enum(["web", "kjv", "asv"]).default("web"),
});

type CacheEntry = { at: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_reference", details: parsed.error.flatten() }, 400);

  const { reference, translation } = parsed.data;
  const normalized = reference.replace(/\s+/g, " ").toLowerCase();
  const cacheKey = `${translation}|${normalized}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return json(hit.payload, 200, { "Cache-Control": "public, max-age=86400" });
  }

  const upstreamUrl = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return json({ error: "upstream_unavailable" }, 502);
  }
  clearTimeout(timer);

  if (upstream.status === 404) return json({ error: "not_found" }, 404);
  if (!upstream.ok) return json({ error: "upstream_unavailable", status: upstream.status }, 502);

  let data: any;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: "upstream_unavailable" }, 502);
  }

  if (!Array.isArray(data?.verses) || data.verses.length === 0) {
    return json({ error: "not_found" }, 404);
  }

  const first = data.verses[0];
  const payload = {
    canonical: String(data.reference ?? `${first.book_name} ${first.chapter}`),
    book: String(first.book_name ?? ""),
    chapter: Number(first.chapter ?? 0),
    translation,
    verses: data.verses.map((v: any) => ({
      verse: Number(v.verse),
      text: String(v.text ?? "").trim(),
    })),
  };

  // Evict oldest if over cap.
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, { at: Date.now(), payload });

  return json(payload, 200, { "Cache-Control": "public, max-age=86400" });
});