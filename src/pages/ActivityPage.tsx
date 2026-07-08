/**
 * E2 · /songs/:id/activity — "What changed since you left."
 *
 * Calm activity intelligence (Product Vision 08): a returning collaborator
 * understands what changed in one glance — grouped, plain-English, warm.
 * No red badges, no unread dots, no raw lyric/memo content (cards render
 * from kind + actor + count only; see components/activity/activityCopy.ts).
 *
 * Cards LINK to the surface that changed; acting on it (restoring a version,
 * reviewing a suggestion) belongs to other lanes (E3, D-group).
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Feather, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import ActivityCard from "@/components/activity/ActivityCard";
import RecapBanner from "@/components/activity/RecapBanner";
import { activityHref } from "@/components/activity/activityCopy";
import { useActivityFeed, type ActivityGroup } from "@/components/activity/useActivityFeed";
import { stagger } from "@/lib/motion";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
  >
    {children}
  </h2>
);

const SkeletonCard = () => (
  <div
    className="rounded-2xl px-4 py-4 animate-pulse"
    style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
  >
    <div className="flex items-start gap-3">
      <div className="rounded-full" style={{ width: 36, height: 36, backgroundColor: "var(--cog-cream-dark)" }} />
      <div className="flex-1 pt-1">
        <div className="h-3 rounded-full w-3/4 mb-2" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
        <div className="h-2.5 rounded-full w-1/2" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
      </div>
    </div>
  </div>
);

const ActivityPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "";
  const reduceMotion = useReducedMotion();

  const {
    detail,
    hasBaseline,
    sinceGroups,
    earlierGroups,
    sinceCount,
    recap,
    isLoading,
    isError,
    isEmpty,
  } = useActivityFeed(songId);

  const openGroup = (group: ActivityGroup) => navigate(activityHref(songId, group.kind));

  const isOwner = detail?.my_role === "owner";
  const pendingReviews = detail?.counts.pending_suggestions ?? 0;

  const subline = (() => {
    if (isLoading || !detail) return null;
    if (isEmpty) return `${detail.title} · quiet so far`;
    if (!hasBaseline) return `${detail.title} · the story so far`;
    if (sinceCount === 0) return `${detail.title} · everything's as you left it`;
    return `${detail.title} · ${sinceCount} ${sinceCount === 1 ? "change" : "changes"}`;
  })();

  const listMotion = reduceMotion
    ? {}
    : { variants: stagger(), initial: "initial" as const, animate: "animate" as const };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pb-28"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}/room`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        {/* Headline */}
        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          What changed since you left
        </h1>
        {subline ? (
          <p className="text-sm mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
            {subline}
          </p>
        ) : (
          <div className="mb-8" />
        )}

        {/* Loading — a calm skeleton, never a spinner wall */}
        {isLoading && (
          <div className="flex flex-col gap-3" role="status" aria-label="Gathering what changed">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error — quiet, with a way home */}
        {!isLoading && isError && (
          <div
            className="rounded-2xl px-4 py-6 text-center"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              We couldn't gather the song's activity just now. It's all still safe — try again in a moment.
            </p>
          </div>
        )}

        {/* Empty — warm, never a void */}
        {!isLoading && !isError && isEmpty && (
          <div className="flex flex-col items-center text-center py-10">
            <div
              className="flex items-center justify-center rounded-full mb-4"
              style={{ width: 56, height: 56, backgroundColor: "rgba(184,149,58,0.12)" }}
            >
              <Feather size={24} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
            </div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              Nothing's changed yet
            </p>
            <p
              className="text-sm max-w-[260px]"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              Invite someone in or start writing — every change to this song will be remembered here.
            </p>
          </div>
        )}

        {/* The feed */}
        {!isLoading && !isError && !isEmpty && (
          <>
            {/* Since you left — the signature delta. aria-live lets realtime
                arrivals announce politely without stealing focus. */}
            {hasBaseline && sinceGroups.length > 0 && (
              <section className="mb-7" aria-label="Since you left">
                <SectionLabel>Since you left</SectionLabel>
                {recap && <RecapBanner text={recap} />}
                <motion.div className="flex flex-col gap-3" aria-live="polite" {...listMotion}>
                  {sinceGroups.map((group) => (
                    <ActivityCard key={group.key} group={group} onOpen={openGroup} />
                  ))}
                </motion.div>
              </section>
            )}

            {/* Owner-only rollup: link to the review queue — the acting
                (accept/decline) lives in the review surface, never here. */}
            {isOwner && pendingReviews > 0 && (
              <div className="mb-7">
                <button
                  type="button"
                  onClick={() => navigate(`/songs/${songId}/canvas`)}
                  aria-label={`${pendingReviews} ${pendingReviews === 1 ? "idea is" : "ideas are"} waiting for your review. Open the review queue`}
                  className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--cog-cream-light)",
                    border: "1.5px solid var(--cog-border)",
                    boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
                    borderLeft: "3px solid var(--cog-gold)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      aria-hidden="true"
                      className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: "rgba(184,149,58,0.12)",
                        color: "var(--cog-gold)",
                      }}
                    >
                      <MessageSquare size={16} strokeWidth={1.6} />
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-sm font-semibold leading-snug"
                        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                      >
                        {pendingReviews} {pendingReviews === 1 ? "idea is" : "ideas are"} waiting for your review
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                      >
                        Take a look when you're ready — nothing is lost
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Quiet reassurance when you're caught up but history exists */}
            {hasBaseline && sinceGroups.length === 0 && earlierGroups.length > 0 && (
              <p
                className="text-sm mb-7"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                You're all caught up — nothing new since your last visit.
              </p>
            )}

            {/* Earlier */}
            {earlierGroups.length > 0 && (
              <section className="mb-6" aria-label={hasBaseline ? "Earlier" : "Recent activity"}>
                <SectionLabel>{hasBaseline ? "Earlier" : "Recent activity"}</SectionLabel>
                <motion.div className="flex flex-col gap-3" {...listMotion}>
                  {earlierGroups.map((group) => (
                    <ActivityCard key={group.key} group={group} onOpen={openGroup} />
                  ))}
                </motion.div>
              </section>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-auto pt-6">
          <button
            onClick={() => navigate(`/songs/${songId}/room`)}
            className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-gold)",
              fontFamily: "var(--font-body)",
              boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
            }}
          >
            Back to the song
          </button>
        </div>
      </div>
      <SongTabBar />
    </div>
  );
};

export default ActivityPage;
