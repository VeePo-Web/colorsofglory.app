import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/voice/audioFormat";

interface PeekItem {
  memo_id: string;
  song_id: string;
  song_title: string;
  title: string | null;
  duration_ms: number | null;
  section_count: number;
  created_at: string;
}

/**
 * Below-the-dock strip of the user's most recent 3 captures.
 *
 * Builds the muscle memory that capture *goes somewhere* — tap a card
 * and the parent reopens the review sheet for that take.
 *
 * Read-only — no DB writes. Uses the takes/voice_memos tables already in
 * place (no SDK change needed).
 */
const LatestPeekStrip = ({
  onResume,
}: {
  onResume?: (memoId: string, songId: string) => void;
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PeekItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        if (!cancelled) setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("voice_memos")
        .select("id, song_id, title, duration_ms, created_at, songs(title), takes(transcript_json)")
        .eq("author_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(3);
      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        return;
      }
      const mapped: PeekItem[] = data.map((row) => {
        const blocks =
          (row.takes as Array<{ transcript_json?: { blocks?: unknown[] } }> | null)?.[0]
            ?.transcript_json?.blocks ?? [];
        return {
          memo_id: row.id as string,
          song_id: row.song_id as string,
          song_title: (row.songs as { title?: string } | null)?.title ?? "Untitled",
          title: (row.title as string | null) ?? null,
          duration_ms: (row.duration_ms as number | null) ?? null,
          section_count: Array.isArray(blocks) ? blocks.length : 0,
          created_at: row.created_at as string,
        };
      });
      setItems(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items == null || items.length === 0) return null;

  return (
    <section
      aria-label="Latest captures"
      className="w-full"
      style={{ marginTop: 8 }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--cog-warm-gray)",
          margin: "0 0 8px 4px",
        }}
      >
        Latest
      </p>
      <div
        className="flex overflow-x-auto"
        style={{
          gap: 10,
          paddingBottom: 6,
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((it) => (
          <button
            key={it.memo_id}
            type="button"
            onClick={() =>
              onResume
                ? onResume(it.memo_id, it.song_id)
                : navigate(`/songs/${it.song_id}/canvas`)
            }
            className="text-left transition-transform active:scale-[0.98]"
            style={{
              flex: "0 0 200px",
              padding: "12px 14px",
              borderRadius: 16,
              background: "var(--cog-cream-light, #faf7f2)",
              border: "1px solid rgba(184,149,58,0.20)",
              boxShadow: "0 2px 8px rgba(28,26,23,0.04)",
              cursor: "pointer",
              color: "var(--cog-charcoal)",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 140,
                }}
              >
                {it.title ?? it.song_title}
              </span>
              <Play size={12} style={{ color: "var(--cog-gold)" }} fill="currentColor" />
            </div>
            <div
              className="flex items-center"
              style={{ gap: 6, fontSize: 11, color: "var(--cog-warm-gray)" }}
            >
              {it.duration_ms != null && <span>{formatDuration(it.duration_ms)}</span>}
              {it.section_count > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {it.section_count} {it.section_count === 1 ? "section" : "sections"}
                  </span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default LatestPeekStrip;