import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";
import { logActivity } from "../_shared/activity.ts";

type IncomingBlock = {
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind?: string | null;
  label?: string | null;
  text?: string;
  start_ms?: number;
  end_ms?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const take_id: string | null = typeof body.take_id === "string" ? body.take_id : null;
    const incomingSongId: string | null = typeof body.song_id === "string" ? body.song_id : null;
    const newSongTitle: string | null =
      typeof body.new_song_title === "string" ? body.new_song_title.trim().slice(0, 200) : null;
    const blocks: IncomingBlock[] = Array.isArray(body.blocks) ? body.blocks : [];

    if (!take_id) return jsonResponse({ error: "take_id required" }, 400);
    if (blocks.length === 0) return jsonResponse({ error: "blocks required" }, 400);

    const admin = adminClient();

    const { data: take, error: takeErr } = await admin
      .from("takes")
      .select("id, song_id, voice_memo_id")
      .eq("id", take_id)
      .maybeSingle();
    if (takeErr || !take) return jsonResponse({ error: "take_not_found" }, 404);

    let targetSongId = incomingSongId ?? take.song_id;

    // Branch: user chose to commit into a brand-new song.
    if (incomingSongId === "__new__") {
      if (!newSongTitle) return jsonResponse({ error: "new_song_title required" }, 400);
      const { data: allowed, error: gateErr } = await admin.rpc("can_create_song", { _user_id: user.id });
      if (gateErr) return jsonResponse({ error: gateErr.message }, 500);
      if (!allowed) return jsonResponse({ error: "song_limit_reached", code: "free_plan_limit" }, 402);

      const { data: song, error: insErr } = await admin
        .from("songs")
        .insert({ owner_user_id: user.id, title: newSongTitle, status: "active" })
        .select("id")
        .single();
      if (insErr || !song) return jsonResponse({ error: insErr?.message ?? "create_failed" }, 500);
      targetSongId = song.id;
    }

    // Verify membership in the target song.
    const { data: isMember, error: memErr } = await admin.rpc("is_song_member", {
      _song_id: targetSongId,
      _user_id: user.id,
    });
    if (memErr || !isMember) return jsonResponse({ error: "forbidden" }, 403);

    // If the take was orphaned (song_id pointed at an "unfiled" placeholder)
    // and we're committing into a new/different song, reparent it best-effort.
    if (take.song_id !== targetSongId) {
      await admin.from("takes").update({ song_id: targetSongId }).eq("id", take_id);
    }

    // Find current max position for stable ordering.
    const { data: lastCard } = await admin
      .from("canvas_cards")
      .select("position")
      .eq("song_id", targetSongId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    let pos = (lastCard?.position ?? -1) + 1;

    const rows = blocks.map((b) => ({
      song_id: targetSongId,
      created_by: user.id,
      take_id: take_id,
      kind: b.kind,
      section_kind: b.section_kind ?? null,
      label: (b.label ?? "").slice(0, 80) || null,
      body: (b.text ?? "").slice(0, 10000),
      start_ms: Number.isFinite(b.start_ms as number) ? Math.max(0, b.start_ms as number) : null,
      end_ms: Number.isFinite(b.end_ms as number) ? Math.max(0, b.end_ms as number) : null,
      position: pos++,
    }));

    const { data: inserted, error: cardErr } = await admin
      .from("canvas_cards")
      .insert(rows)
      .select("id");
    if (cardErr) return jsonResponse({ error: cardErr.message }, 500);

    await admin.from("songs").update({ last_activity_at: new Date().toISOString() }).eq("id", targetSongId);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "commit_take",
      entity_type: "take",
      entity_id: take_id,
      after: { song_id: targetSongId, card_count: inserted?.length ?? 0 },
    });

    await logActivity(admin, {
      song_id: targetSongId,
      actor_user_id: user.id,
      kind: "take_committed",
      entity_type: "take",
      entity_id: take_id,
      payload: { card_count: inserted?.length ?? 0 },
    });

    return jsonResponse({
      song_id: targetSongId,
      card_ids: (inserted ?? []).map((r) => r.id),
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});