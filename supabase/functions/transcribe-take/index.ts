import { adminClient, corsHeaders, jsonResponse, resolveUser, getEnvOrThrow } from "../_shared/auth.ts";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are transcribing a songwriter's voice memo for a worship-songwriting app.

The recording may include singing, humming, spoken section announcements ("verse one", "chorus", "bridge", "pre-chorus", "tag", "outro"), chord names, scripture references, or free-form ideas.

Return STRICT JSON only, matching this shape:
{
  "blocks": [
    {
      "kind": "section" | "lyrics" | "chords" | "scripture" | "idea",
      "section_kind": "verse"|"chorus"|"pre-chorus"|"bridge"|"tag"|"outro"|"intro"|"hook"|"interlude"|null,
      "label": "Verse 1" | "Chorus" | "Idea" | etc,
      "text": "transcribed text for this block",
      "start_seconds": number,
      "end_seconds": number
    }
  ]
}

Rules:
- When you hear a spoken section announcement, START a new block of kind "section" with that section_kind and label, and put the lyrics that follow into the text of the SAME block.
- If no sections are announced, emit a single block with kind "idea" and label "Idea".
- For pure humming or melody, set text to "[humming]" or "[melody]".
- Output JSON only. No prose, no markdown, no code fences.`;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function safeParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const LOVABLE_API_KEY = getEnvOrThrow("LOVABLE_API_KEY");
    const { take_id } = await req.json().catch(() => ({}));
    if (!take_id || typeof take_id !== "string") return jsonResponse({ error: "take_id required" }, 400);

    const admin = adminClient();

    const { data: take, error: takeErr } = await admin
      .from("takes")
      .select("id, song_id, storage_path, mime_type, transcript_status")
      .eq("id", take_id)
      .maybeSingle();
    if (takeErr || !take) return jsonResponse({ error: "take_not_found" }, 404);

    const { data: isMember, error: memErr } = await admin.rpc("is_song_member", {
      _song_id: take.song_id,
      _user_id: user.id,
    });
    if (memErr || !isMember) return jsonResponse({ error: "forbidden" }, 403);

    await admin.from("takes").update({ transcript_status: "processing", transcript_error: null }).eq("id", take_id);

    try {
      const { data: file, error: dlErr } = await admin.storage
        .from("voice-memos")
        .download(take.storage_path);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "download_failed");

      const base64 = await blobToBase64(file);
      const format = (take.mime_type ?? "audio/webm").split("/")[1] ?? "webm";

      const aiResp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe this voice memo into structured blocks." },
                { type: "input_audio", input_audio: { data: base64, format } },
              ],
            },
          ],
        }),
      });

      if (aiResp.status === 429) {
        await admin.from("takes").update({ transcript_status: "failed", transcript_error: "rate_limited" }).eq("id", take_id);
        return jsonResponse({ error: "rate_limited" }, 429);
      }
      if (aiResp.status === 402) {
        await admin.from("takes").update({ transcript_status: "failed", transcript_error: "credits_exhausted" }).eq("id", take_id);
        return jsonResponse({ error: "credits_exhausted" }, 402);
      }
      if (!aiResp.ok) {
        const errText = await aiResp.text();
        throw new Error(`ai_gateway_${aiResp.status}: ${errText.slice(0, 300)}`);
      }

      const aiJson = await aiResp.json();
      const content: string = aiJson.choices?.[0]?.message?.content ?? "";
      const parsed = safeParseJson(content) as { blocks?: unknown[] } | null;
      const blocksRaw = Array.isArray(parsed?.blocks) ? parsed!.blocks : [];

      const blocks = blocksRaw.map((b: any, idx: number) => ({
        id: `block-${idx}`,
        kind: typeof b.kind === "string" ? b.kind : "idea",
        section_kind: typeof b.section_kind === "string" ? b.section_kind : null,
        label: typeof b.label === "string" && b.label ? b.label : "Idea",
        text: typeof b.text === "string" ? b.text : "",
        start_ms: Math.max(0, Math.round((Number(b.start_seconds) || 0) * 1000)),
        end_ms: Math.max(0, Math.round((Number(b.end_seconds) || 0) * 1000)),
      }));

      const payload = { model: MODEL, blocks, raw_text: blocks.map((b) => b.text).join("\n\n") };

      await admin
        .from("takes")
        .update({ transcript_status: "ready", transcript_json: payload, transcript_error: null })
        .eq("id", take_id);

      return jsonResponse({ take_id, status: "ready", blocks });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("takes")
        .update({ transcript_status: "failed", transcript_error: msg.slice(0, 500) })
        .eq("id", take_id);
      return jsonResponse({ error: msg }, 500);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});