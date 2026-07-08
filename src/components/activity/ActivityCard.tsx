/**
 * E2 · ActivityCard — one calm, content-free update card (matches reference
 * download (20): cream card, actor-color left border, avatar initials,
 * sentence + quiet sub + relative time). Renders from kind + actor + count
 * only — no payload text ever reaches this component.
 */
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cardEntrance } from "./motion";
import { relativeTime } from "@/lib/notes/relativeTime";
import { activitySentence, copyForKind, UNKNOWN_ACTOR } from "./activityCopy";
import type { ActivityGroup } from "./useActivityFeed";

interface ActivityCardProps {
  group: ActivityGroup;
  onOpen: (group: ActivityGroup) => void;
}

const ActivityCard = ({ group, onOpen }: ActivityCardProps) => {
  const reduceMotion = useReducedMotion();
  const copy = copyForKind(group.kind);
  const Icon = copy.icon;
  const sentence = activitySentence(group.kind, group.actorName, group.count);
  const time = relativeTime(group.lastAt);
  // DB actor colors are hex (tintable with an alpha suffix); the neutral
  // fallback is a CSS token, which gets a token tint instead.
  const avatarBg = group.color.startsWith("#")
    ? `${group.color}22`
    : "var(--cog-cream-dark)";

  return (
    <motion.button
      type="button"
      variants={reduceMotion ? undefined : cardEntrance}
      onClick={() => onOpen(group)}
      aria-label={`${sentence}, ${time}. Open`}
      className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.98]"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border)",
        boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
        borderLeft: `3px solid ${group.color}`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Actor avatar — color is always paired with initials, never alone */}
        <div
          aria-hidden="true"
          className="flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
          style={{
            width: 36,
            height: 36,
            backgroundColor: avatarBg,
            color: group.color,
            fontFamily: "var(--font-body)",
          }}
        >
          {group.initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-sm font-semibold leading-snug"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              {sentence}
            </p>
            <span
              className="text-xs flex-shrink-0"
              style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
            >
              {time}
            </span>
          </div>
          <p
            className="flex items-center gap-1.5 text-xs mt-0.5"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            <Icon size={12} strokeWidth={1.6} aria-hidden="true" />
            {copy.sub}
          </p>
        </div>

        <ChevronRight
          size={16}
          strokeWidth={1.6}
          aria-hidden="true"
          className="flex-shrink-0 mt-2"
          style={{ color: "var(--cog-muted)" }}
        />
      </div>
    </motion.button>
  );
};

export const activityCardAccessibleName = (group: ActivityGroup): string =>
  activitySentence(group.kind, group.actorName ?? UNKNOWN_ACTOR, group.count);

export default ActivityCard;
