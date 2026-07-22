import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { humanizeActivityKind } from "../_shared/email.ts";
import { enqueueEmail } from "../_shared/emailGovernance.ts";

// The scheduled lifecycle-email brain (docs/email/COG-EMAIL-SYSTEM.md §8.3).
// Run daily by cron (service role). It EVALUATES gates and ENQUEUES — it
// never sends; the governed drain (notify-referral-event) owns delivery,
// caps, quiet hours, and suppressions. Everything it enqueues is deduped by
// a DB constraint, so re-running is always safe.
//
// Programs evaluated:
//   D1 digest.what_changed — per (member × song) with OTHER-actor activity
//     since that member's last visit; weekly per song via an ISO-week key.
//   B1 edu.hum_capture     — signed up 2–14 days ago, has a song, zero
//     voice memos authored. Once ever.
//   B2 edu.lyrics_chords   — signed up 4–21 days ago, has memos, song has
//     zero lyric lines. Once ever.
//
// THE PRIVACY FENCE: payloads carry song titles, display names, and
// HUMANIZED KIND PHRASES only ("Sarah added 2 voice memos") — never lyric,
// memo, transcript, or note content. Same allow-list as digest-recap.

const DAY = 24 * 3600 * 1000;

function isoWeek(d: Date): string {
  // ISO-8601 week number — the D1 dedupe period.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const week = isoWeek(now);
  let digests = 0, edu = 0, scannedSongs = 0, scannedProfiles = 0;

  // ── D1 · digest.what_changed ────────────────────────────────────────────
  try {
    // Songs with any activity in the last 7 days (bounded).
    const since7d = new Date(now.getTime() - 7 * DAY).toISOString();
    const { data: activeSongs } = await admin
      .from("song_activity")
      .select("song_id")
      .gte("created_at", since7d)
      .limit(2000);
    const songIds = Array.from(new Set((activeSongs ?? []).map((r) => r.song_id))).slice(0, 200);

    for (const songId of songIds) {
      if (digests >= 300) break; // work budget — the rest catch the next run
      scannedSongs++;
      const { data: members } = await admin
        .from("song_members")
        .select("user_id")
        .eq("song_id", songId)
        .limit(20);
      if (!members || members.length < 2) continue; // solo rooms have no "what changed"

      const { data: song } = await admin
        .from("songs")
        .select("title")
        .eq("id", songId)
        .maybeSingle();
      const songTitle = song?.title ?? "your song";

      for (const m of members) {
        // Since this member's last visit (fallback: the 7-day window).
        const { data: pref } = await admin
          .from("song_notification_prefs")
          .select("last_seen_at")
          .eq("song_id", songId)
          .eq("user_id", m.user_id)
          .maybeSingle();
        const since = pref?.last_seen_at && pref.last_seen_at > since7d ? pref.last_seen_at : since7d;

        const { data: events } = await admin
          .from("song_activity")
          .select("kind, actor_user_id")
          .eq("song_id", songId)
          .gte("created_at", since)
          .neq("actor_user_id", m.user_id)
          .limit(200);
        const others = (events ?? []).filter((e) => e.actor_user_id);
        if (others.length === 0) continue; // nothing changed → not sent (§5 D1)

        // Group (actor, kind) → "Name did X n times", newest-agnostic order.
        const actorIds = Array.from(new Set(others.map((e) => e.actor_user_id as string)));
        const { data: profs } = await admin
          .from("profiles")
          .select("user_id, display_name, first_name")
          .in("user_id", actorIds);
        const names = new Map(
          (profs ?? []).map((p) => [
            p.user_id,
            p.display_name?.trim() || p.first_name?.trim() || "Someone",
          ]),
        );
        const counts = new Map<string, number>();
        for (const e of others) counts.set(`${e.actor_user_id}|${e.kind}`, (counts.get(`${e.actor_user_id}|${e.kind}`) ?? 0) + 1);
        const lines = Array.from(counts.entries()).map(([key, n]) => {
          const [actor, kind] = key.split("|");
          return `${names.get(actor) ?? "Someone"} ${humanizeActivityKind(kind, n)}`;
        });

        await enqueueEmail(admin, {
          user_id: m.user_id,
          kind: "digest.what_changed",
          category: "digest",
          payload: { song_id: songId, song_title: songTitle, lines: lines.slice(0, 8) },
          dedupe_key: `digest.what_changed:${songId}:${m.user_id}:${week}`,
        });
        digests++;
      }
    }
  } catch (e) {
    console.error("[evaluator] digest_pass_failed", String(e));
  }

  // ── B1/B2 · education (event-gated, once ever) ──────────────────────────
  try {
    const oldest = new Date(now.getTime() - 21 * DAY).toISOString();
    const newest = new Date(now.getTime() - 2 * DAY).toISOString();
    const { data: recent } = await admin
      .from("profiles")
      .select("user_id, email, first_song_id, created_at")
      .gte("created_at", oldest)
      .lte("created_at", newest)
      .not("email", "is", null)
      .limit(500);

    for (const prof of recent ?? []) {
      scannedProfiles++;
      const { data: songRow } = prof.first_song_id
        ? await admin.from("songs").select("id, title").eq("id", prof.first_song_id).maybeSingle()
        : await admin
            .from("songs")
            .select("id, title")
            .eq("created_by", prof.user_id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
      if (!songRow) continue; // no song yet → A2's territory, not education's

      const { count: memoCount } = await admin
        .from("voice_memos")
        .select("id", { count: "exact", head: true })
        .eq("author_user_id", prof.user_id);

      if ((memoCount ?? 0) === 0) {
        // B1: has a room, hasn't hummed into it yet.
        await enqueueEmail(admin, {
          user_id: prof.user_id,
          kind: "edu.hum_capture",
          category: "edu",
          payload: { song_id: songRow.id, song_title: songRow.title },
          dedupe_key: `edu.hum_capture:${prof.user_id}`,
        });
        edu++;
        continue; // one education thread at a time — B2 waits for memos
      }

      const ageDays = (now.getTime() - new Date(prof.created_at).getTime()) / DAY;
      if (ageDays >= 4) {
        const { count: lyricCount } = await admin
          .from("song_lyrics")
          .select("id", { count: "exact", head: true })
          .eq("song_id", songRow.id);
        if ((lyricCount ?? 0) === 0) {
          // B2: melodies captured, no words yet.
          await enqueueEmail(admin, {
            user_id: prof.user_id,
            kind: "edu.lyrics_chords",
            category: "edu",
            payload: { song_id: songRow.id, song_title: songRow.title },
            dedupe_key: `edu.lyrics_chords:${prof.user_id}`,
          });
          edu++;
        }
      }
    }
  } catch (e) {
    console.error("[evaluator] education_pass_failed", String(e));
  }

  return new Response(
    JSON.stringify({ ok: true, week, digests, edu, scannedSongs, scannedProfiles }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
