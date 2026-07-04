import { useCallback, useEffect, useState } from "react";
import SeedIdeaCard, { type SeedIdeaCardSong } from "./SeedIdeaCard";
import { listSeedIdeas, type SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";

interface SeedIdeasShelfProps {
  songs: SeedIdeaCardSong[];
}

/**
 * SeedIdeasShelf — a horizontal shelf of captured ideas waiting for a home.
 * Sits above the song grid so a hummed idea is never more than a glance away
 * from becoming part of a song. Stays completely out of sight — not even its
 * label — when there's nothing waiting to be filed; an empty shelf is just
 * noise in a calm catalog.
 */
const SeedIdeasShelf = ({ songs }: SeedIdeasShelfProps) => {
  const [ideas, setIdeas] = useState<SeedIdeaRecord[] | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    listSeedIdeas()
      .then((records) => {
        if (!cancelled) setIdeas(records);
      })
      .catch(() => {
        if (!cancelled) setIdeas([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);

  if (!ideas || ideas.length === 0) return null;

  return (
    <section aria-label="Your captured ideas, waiting to be filed into a song" className="mb-5">
      <p
        className="font-semibold uppercase mb-3"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--t-eyebrow)",
          letterSpacing: "0.16em",
          color: "var(--cog-warm-gray)",
        }}
      >
        Your Ideas
      </p>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          marginInline: "-1rem",
          paddingInline: "1rem",
        }}
      >
        {ideas.map((idea) => (
          <SeedIdeaCard key={idea.id} idea={idea} songs={songs} onClaimed={refresh} onDiscarded={refresh} />
        ))}
      </div>
    </section>
  );
};

export default SeedIdeasShelf;
