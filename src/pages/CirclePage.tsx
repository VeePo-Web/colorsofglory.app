import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, HandHeart, Users } from "lucide-react";
import BottomNav from "@/components/cog/BottomNav";
import { setNavDirection, useSpatialEntrance } from "@/lib/nav/navDirection";
import { useSwipeNav } from "@/lib/nav/useSwipeNav";
import { useCircle } from "@/lib/circle/useCircle";

/**
 * Circle — the swipe-right return surface (docs/CIRCLE-CONTRACT.md).
 *
 * A hearth, not a casino: four calm bands — "while you were away" (real,
 * grouped, others-only), your people (relationships, never counts), amens
 * flowing in, and a warm invite-forward empty state. Finite by
 * construction: hard caps, no infinite scroll, no badges, no metrics.
 * Ignore it and lose nothing.
 *
 * Geography: Circle sits to the RIGHT of Capture
 * (Library ← Capture → Circle). Swipe right (or tap Capture) to go home.
 */

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="mb-3 mt-8 first:mt-0"
    style={{
      fontFamily: "var(--font-display)",
      fontSize: "1.25rem",
      color: "var(--cog-charcoal)",
      lineHeight: 1.2,
    }}
  >
    {children}
  </h2>
);

const CirclePage = () => {
  const navigate = useNavigate();
  const { loading, lines, people, amens, aloneSoFar } = useCircle();

  // Spatial nav — Capture lives to the LEFT of Circle. Swiping right pages
  // back to the mic; the header chevron stays the visible contract.
  const pageRef = useRef<HTMLDivElement>(null);
  const goToCapture = useCallback(() => {
    setNavDirection("left");
    navigate("/");
  }, [navigate]);
  useSwipeNav(pageRef, { onSwipeRight: goToCapture });
  const enterClass = useSpatialEntrance(useLocation().pathname);

  return (
    <div
      ref={pageRef}
      className={`min-h-dvh flex flex-col ${enterClass}`}
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* The hearth glow — warmer than the standard bottom glow: this is
          the room where your people are. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% 20%, rgba(184,149,58,0.14) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-5 pb-32"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header — the way back to the mic, mirrored from Capture's Songs chevron. */}
        <div
          className="flex items-center justify-between pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <button
            type="button"
            onClick={goToCapture}
            aria-label="Back to capture"
            className="flex items-center transition-transform active:scale-95"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--cog-charcoal)",
              cursor: "pointer",
              padding: "8px 10px 8px 6px",
              minHeight: 44,
            }}
          >
            <ChevronLeft size={20} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, marginLeft: 2 }}>
              Capture
            </span>
          </button>
        </div>

        <h1
          className="mb-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Your circle
        </h1>
        <p
          className="mb-6"
          style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-warm-gray)" }}
        >
          The people tending these songs with you.
        </p>

        {loading ? (
          <div className="flex flex-col gap-3" aria-label="Loading your circle">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl"
                style={{ height: 64, backgroundColor: "rgba(28,26,23,0.05)" }}
              />
            ))}
          </div>
        ) : aloneSoFar ? (
          // The warm empty state — invite-forward, zero guilt.
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1px solid var(--cog-border)",
            }}
          >
            <Users size={22} strokeWidth={1.6} style={{ color: "var(--cog-gold)", margin: "0 auto 10px" }} />
            <p
              className="mb-2"
              style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--cog-charcoal)" }}
            >
              Your circle begins with one invitation.
            </p>
            <p
              className="mb-4"
              style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}
            >
              A song was never meant to live alone in one person's phone. Bring in a co-writer,
              a worship leader, the friend who always finds the line — and this room comes alive.
            </p>
            <button
              type="button"
              onClick={() => {
                setNavDirection("left");
                navigate("/songs");
              }}
              className="rounded-xl px-5 transition-transform active:scale-[0.97]"
              style={{
                minHeight: 44,
                backgroundColor: "var(--cog-gold)",
                color: "#FFF",
                border: "none",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open your songs
            </button>
          </div>
        ) : (
          <>
            {/* Band 1 — while you were away (only when something real happened) */}
            {lines.length > 0 && (
              <section aria-label="While you were away">
                <SectionTitle>While you were away…</SectionTitle>
                <div className="flex flex-col gap-2">
                  {lines.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setNavDirection("up");
                        navigate(`/songs/${l.songId}/activity`);
                      }}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.985]"
                      style={{
                        backgroundColor: "var(--cog-cream-light)",
                        border: "1px solid var(--cog-border)",
                        cursor: "pointer",
                        minHeight: 56,
                      }}
                      aria-label={`${l.text} in ${l.songTitle} — open activity`}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: l.dotColor,
                          flexShrink: 0,
                        }}
                      />
                      <span className="flex-1 min-w-0">
                        <span
                          className="block truncate"
                          style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-charcoal)" }}
                        >
                          {l.text}
                        </span>
                        <span
                          className="block truncate"
                          style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-warm-gray)" }}
                        >
                          {l.songTitle} · {relativeTime(l.lastAt)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Band 2 — amens flowing in (encouragement, never a metric wall) */}
            {amens.total > 0 && (
              <section aria-label="Encouragement received">
                <SectionTitle>Encouragement came in</SectionTitle>
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: "rgba(184,149,58,0.08)",
                    border: "1px solid rgba(184,149,58,0.22)",
                  }}
                >
                  <HandHeart size={18} strokeWidth={1.8} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-charcoal)", lineHeight: 1.5 }}>
                    {amens.total === 1 ? "An amen was left" : `${amens.total} amens were left`} on ideas in{" "}
                    <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                      {amens.songTitles.join(", ")}
                    </span>
                    .
                  </p>
                </div>
              </section>
            )}

            {/* Band 3 — your people */}
            {people.length > 0 && (
              <section aria-label="Your people">
                <SectionTitle>Your people</SectionTitle>
                <div className="flex flex-col gap-2">
                  {people.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3"
                      style={{
                        backgroundColor: "var(--cog-cream-light)",
                        border: "1px solid var(--cog-border)",
                        minHeight: 56,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex items-center justify-center"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          backgroundColor: p.color,
                          color: "#FFF",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "var(--font-body)",
                          flexShrink: 0,
                        }}
                      >
                        {p.initials}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className="block truncate"
                          style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--cog-charcoal)" }}
                        >
                          {p.name}
                        </span>
                        <span
                          className="block truncate"
                          style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-warm-gray)" }}
                        >
                          writing {p.sharedTitles.join(" · ")} with you
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* A quiet week is a feature — say so, warmly, and stop. */}
            {lines.length === 0 && amens.total === 0 && people.length > 0 && (
              <div
                className="rounded-2xl px-4 py-4"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
              >
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}>
                  All quiet since you were last here. Your songs are safe, your people are near —
                  and the mic is one swipe away.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CirclePage;
