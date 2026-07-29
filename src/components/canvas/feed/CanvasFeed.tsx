import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Sparkles } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";
import CreativeActionDock, { type CreativeDockAction } from "@/components/cog/CreativeActionDock";
import FeedCard from "./FeedCard";
import FinalListenPage from "./FinalListenPage";
import SwipePromoteRow from "./SwipePromoteRow";
import { ideasFeedGroups, finalFeedCards, SPARKS_GROUP, USED_GROUP } from "@/lib/canvas/feed/feedModel";
import { usePrefersReducedMotion } from "@/lib/canvas/features";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import { useVibration } from "@/hooks/useVibration";

/**
 * CanvasFeed — the Glory Feed: the canvas's mobile-first vertical lens.
 *
 * Two full-screen pages, one journey: IDEAS (the gold stream where sparks
 * live, grouped by song part) ⇄ FINAL (the sage listen-mode set list). The
 * pager slides cinematically; promoting an idea flies a ghost toward the
 * Final tab, which pulses warm as the idea lands. The 2D room stays one tap
 * away as the Map — same cards, same interactions, two lenses.
 */

export type FeedPage = "ideas" | "final";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Direction-locked horizontal swipe between the two pages. */
const SWIPE_MIN_PX = 48;
const SWIPE_RATIO = 1.5;

export interface CanvasFeedProps {
  cards: CanvasBoardCard[];
  selectedId: string | null;
  getInteractions: (card: CanvasBoardCard) => CanvasCardInteractions;
  cardAdornment?: (card: CanvasBoardCard) => ReactNode;
  dockActions: CreativeDockAction[];
  listening: boolean;
  currentListenId: string | null;
  /** The song played all the way through — the Final page offers what's next. */
  listenFinished: boolean;
  /** Paused mid-song — the Final page keeps its transport up for Resume. */
  listenPaused: boolean;
  /** Nonce: a moment (e.g. the promote toast's "Hear it") asks the feed to
   *  turn to the Final page. Every bump turns the page. */
  finalPageRequest?: number;
  onPlaySong: (ids: string[]) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReorderFinal: (id: string, delta: number) => void;
  isViewer: boolean;
}

const CanvasFeed = memo(function CanvasFeed({
  cards,
  selectedId,
  getInteractions,
  cardAdornment,
  dockActions,
  listening,
  currentListenId,
  listenFinished,
  listenPaused,
  finalPageRequest = 0,
  onPlaySong,
  onPlayPause,
  onNext,
  onPrev,
  onReorderFinal,
  isViewer,
}: CanvasFeedProps) {
  const [page, setPage] = useState<FeedPage>("ideas");
  // A moment asked for the Final page (the promote toast's "Hear it") —
  // turn to it. Nonce-driven so back-to-back requests both turn.
  useEffect(() => {
    if (finalPageRequest > 0) setPage("final");
  }, [finalPageRequest]);
  const [finalPulse, setFinalPulse] = useState(false);
  const [ghost, setGhost] = useState<{ from: DOMRect; toX: number; toY: number; go: boolean } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { vibrate } = useVibration();
  const finalTabRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number; locked: "h" | "v" | null } | null>(null);

  const groups = useMemo(() => ideasFeedGroups(cards), [cards]);
  const finalCards = useMemo(() => finalFeedCards(cards), [cards]);
  const hasIdeas = groups.some((g) => g.label !== USED_GROUP);
  // The entrance cascade: one running position across every group, so the
  // page settles top-to-bottom in one continuous fall (capped — deep cards
  // arrive together rather than making the writer wait).
  let entrancePos = 0;
  const nextEntranceDelay = () => Math.min(entrancePos++ * 45, 360);

  /** The cinematic promote: a ghost travels from the card to the Final tab,
   *  the tab pulses warm, THEN the real move runs. Reduced motion: instant. */
  const flyToFinal = useCallback(
    (card: CanvasBoardCard, rect: DOMRect) => {
      const move = () => getInteractions(card).onMoveToFinal();
      vibrate(12);
      if (reducedMotion) {
        move();
        return;
      }
      const tab = finalTabRef.current?.getBoundingClientRect();
      const toX = tab ? tab.left + tab.width / 2 : window.innerWidth - 60;
      const toY = tab ? tab.top + tab.height / 2 : 24;
      setGhost({ from: rect, toX, toY, go: false });
      // Two frames so the ghost paints at its origin before it travels.
      requestAnimationFrame(() => requestAnimationFrame(() => setGhost((g) => (g ? { ...g, go: true } : g))));
      window.setTimeout(() => {
        move();
        setGhost(null);
        setFinalPulse(true);
        window.setTimeout(() => setFinalPulse(false), 650);
      }, 430);
    },
    [getInteractions, reducedMotion, vibrate],
  );

  // ── Pager swipe (direction-locked; buttons/sheets keep their own events) ──
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id || s.locked) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    s.locked = Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO ? "h" : "v";
    if (s.locked === "h") setPage(dx < 0 ? "final" : "ideas");
  };
  const onPointerEnd = () => {
    swipe.current = null;
  };

  const tabStyle = (active: boolean, tone: "gold" | "sage"): React.CSSProperties => ({
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    fontSize: 13.5,
    // The active page is the head's ONE bold; the inactive tab reads, never
    // shouts (two 800-weight texts at the top was a double headline).
    fontWeight: active ? 800 : 600,
    letterSpacing: "0.01em",
    color: active ? "#FFFFFF" : "var(--cog-warm-gray)",
    backgroundColor: active
      ? tone === "gold"
        ? "var(--cog-gold, #B8953A)"
        : GLORY.sage.dark
      : "transparent",
    transition: `background-color 240ms ${EASE}, color 240ms ${EASE}, transform 240ms ${EASE}`,
  });

  return (
    <div
      data-canvas-feed="true"
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* Feed keyframes + the TACTILE GRAMMAR, injected once with the feed.
          Every press on this surface compresses (the warm-&-alive register:
          the room responds to your touch), and every keyboard focus wears the
          gold ring — one rule each, the whole surface obeys. */}
      <style>{`
        @keyframes cog-feed-enter { 0% { opacity: 0; transform: translateY(10px) scale(0.985); } 100% { opacity: 1; transform: none; } }
        @keyframes cog-final-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        [data-canvas-feed] button { transition: transform 130ms cubic-bezier(0.25,0.46,0.45,0.94), background-color 150ms ease, color 150ms ease, box-shadow 200ms ease; }
        [data-canvas-feed] button:active { transform: scale(0.96); }
        [data-canvas-feed] [data-feed-card]:active { transform: scale(0.988); }
        [data-canvas-feed] button:focus-visible,
        [data-canvas-feed] [role="button"]:focus-visible {
          outline: 2px solid var(--cog-gold, #B8953A);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-canvas-feed] * { animation: none !important; }
        }
      `}</style>

      {/* The pager head — Ideas | Final. (The whiteboard's map button is
          gone with the whiteboard; the code path back lives behind the
          stored view preference only.) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px" }}>
        <div
          role="tablist"
          aria-label="Ideas and the final song"
          style={{
            flex: 1, display: "flex", gap: 2, padding: 3, borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(28,26,23,0.10)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={page === "ideas"}
            onClick={() => setPage("ideas")}
            style={tabStyle(page === "ideas", "gold")}
          >
            Ideas
          </button>
          <button
            type="button"
            role="tab"
            ref={finalTabRef}
            aria-selected={page === "final"}
            onClick={() => setPage("final")}
            style={{
              ...tabStyle(page === "final", "sage"),
              animation: finalPulse ? `cog-final-pulse 600ms ${EASE}` : "none",
              boxShadow: finalPulse ? `0 0 0 6px ${GLORY.sage.glow}` : "none",
            }}
          >
            Final{finalCards.length > 0 ? ` · ${finalCards.length}` : ""}
          </button>
        </div>
      </div>

      {/* The two full-screen pages, sliding as one continuous surface. */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div
          style={{
            display: "flex",
            width: "200%",
            height: "100%",
            transform: page === "ideas" ? "translateX(0)" : "translateX(-50%)",
            transition: reducedMotion ? "none" : `transform 380ms ${EASE}`,
          }}
        >
          {/* ── IDEAS — the gold stream ── */}
          <section
            aria-label="Ideas"
            style={{ width: "50%", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 16px 220px", boxSizing: "border-box" }}
          >
            {!hasIdeas && (
              <div style={{ padding: "48px 12px", textAlign: "center" }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
                    background: "linear-gradient(140deg, rgba(212,174,92,0.22), rgba(184,149,58,0.12))",
                    border: "1.5px solid rgba(184,149,58,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Sparkles size={22} strokeWidth={1.8} style={{ color: "#B5935A" }} />
                </div>
                {/* Honest per-state story: a truly empty song starts here; a
                    song whose every idea is already IN the Final tells that
                    truth instead ("starts here" over used cards was a lie). */}
                {groups.length === 0 ? (
                  <>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", margin: "0 0 8px" }}>
                      The song starts here
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--cog-warm-gray)", lineHeight: 1.6, margin: 0 }}>
                      Hum it, speak it, or write it — one tap below and the first spark is safe.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", margin: "0 0 8px" }}>
                      Every idea is in the song
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--cog-warm-gray)", lineHeight: 1.6, margin: 0 }}>
                      Swipe to Final to hear it — or catch the next spark below.
                    </p>
                  </>
                )}
              </div>
            )}
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label} style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    margin: "14px 2px 8px",
                    fontFamily: "var(--font-display)",
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: group.label === USED_GROUP ? "var(--cog-muted)" : "var(--cog-charcoal)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  {group.label === SPARKS_GROUP && (
                    <Sparkles size={13} strokeWidth={2} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
                  )}
                  {group.label}
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, color: "var(--cog-muted)" }}>
                    {group.cards.length}
                  </span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.cards.map((card) => (
                    <SwipePromoteRow
                      key={card.id}
                      enabled={!isViewer && card.tree === "ideas" && !card.isDimmedReference}
                      onPromote={(rect) => flyToFinal(card, rect)}
                    >
                      <FeedCard
                        card={card}
                        selected={selectedId === card.id}
                        interactions={getInteractions(card)}
                        adornment={cardAdornment?.(card)}
                        onFlyToFinal={flyToFinal}
                        entranceDelayMs={nextEntranceDelay()}
                      />
                    </SwipePromoteRow>
                  ))}
                </div>
              </section>
            ))}
          </section>

          {/* ── FINAL — the sage listen mode ── */}
          <section
            aria-label="The final song"
            style={{ width: "50%", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", boxSizing: "border-box" }}
          >
            <FinalListenPage
              cards={finalCards}
              selectedId={selectedId}
              getInteractions={getInteractions}
              listening={listening}
              currentId={currentListenId}
              finished={listenFinished}
              paused={listenPaused}
              onPlaySong={onPlaySong}
              onPlayPause={onPlayPause}
              onNext={onNext}
              onPrev={onPrev}
              onReorder={onReorderFinal}
              isViewer={isViewer}
              onGoToIdeas={() => setPage("ideas")}
            />
          </section>
        </div>
      </div>

      {/* The creation dock — Ideas page only; Final owns its own transport.
          Viewers get no dock at all (an all-ghosted dock is not an interface). */}
      {page === "ideas" && dockActions.length > 0 && <CreativeActionDock actions={dockActions} />}

      {/* The traveling ghost — a promoted idea physically flies to Final. */}
      {ghost && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: ghost.from.left,
            top: ghost.from.top,
            width: ghost.from.width,
            height: ghost.from.height,
            borderRadius: 18,
            backgroundColor: "rgba(255,252,247,0.92)",
            border: `2px solid ${GLORY.sage.base}`,
            boxShadow: `0 16px 44px ${GLORY.sage.glow}`,
            pointerEvents: "none",
            zIndex: 900,
            transform: ghost.go
              ? `translate(${ghost.toX - ghost.from.left - ghost.from.width / 2}px, ${ghost.toY - ghost.from.top - ghost.from.height / 2}px) scale(0.08)`
              : "translate(0, 0) scale(1)",
            opacity: ghost.go ? 0.25 : 0.95,
            transition: `transform 420ms ${EASE}, opacity 420ms ${EASE}`,
          }}
        />
      )}
    </div>
  );
});

CanvasFeed.displayName = "CanvasFeed";
export default CanvasFeed;
