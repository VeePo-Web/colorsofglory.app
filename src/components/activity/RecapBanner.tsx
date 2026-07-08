/**
 * E2 · RecapBanner — the optional AI one-paragraph "here's the gist" that
 * leads the "Since you left" section. Warm and quiet; if the digest-recap
 * edge function is slow or down, this simply never renders (the grouped
 * cards never wait on it).
 */
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cardEntrance } from "./motion";

const RecapBanner = ({ text }: { text: string }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      variants={reduceMotion ? undefined : cardEntrance}
      initial={reduceMotion ? undefined : "initial"}
      animate={reduceMotion ? undefined : "animate"}
      aria-label="Recap of what changed"
      className="rounded-2xl px-4 py-4 mb-4"
      style={{
        backgroundColor: "rgba(184,149,58,0.08)",
        border: "1.5px solid rgba(184,149,58,0.25)",
      }}
    >
      <p
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
      >
        <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
        The gist
      </p>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
      >
        {text}
      </p>
    </motion.section>
  );
};

export default RecapBanner;
