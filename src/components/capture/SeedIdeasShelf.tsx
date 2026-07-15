import { useCallback, useEffect, useState } from "react";
import SeedIdeaCard, { type SeedIdeaCardSong } from "./SeedIdeaCard";
import DedicationOffer, { dedicationOfferSeen } from "./DedicationOffer";
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
 *
 * When "Make it a song" births a NEW song from an idea, the one-time
 * dedication offer appears here as its own calm moment — AFTER the idea is
 * already safe in the new song, never before, and never again. It renders
 * outside the ideas gate below so claiming the LAST idea (which empties the
 * shelf) can't swallow the moment.
 */
const SeedIdeasShelf = ({ songs }: SeedIdeasShelfProps) => {
  const [ideas, setIdeas] = useState<SeedIdeaRecord[] | null>(null);
  const [bornSong, setBornSong] = useState<{ id: string; title: string } | null>(null);

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

  const offer =
    bornSong && !dedicationOfferSeen(bornSong.id) ? (
      <DedicationOffer
        songId={bornSong.id}
        songTitle={bornSong.title}
        onDone={() => setBornSong(null)}
      />
    ) : null;

  if (!ideas || ideas.length === 0) return offer;

  return (
    <>
      {offer}
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
          data-no-swipe-nav
          className="flex gap-3 overflow-x-auto pb-1"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            marginInline: "-1rem",
            paddingInline: "1rem",
          }}
        >
          {ideas.map((idea) => (
            <SeedIdeaCard
              key={idea.id}
              idea={idea}
              songs={songs}
              onClaimed={refresh}
              onDiscarded={refresh}
              onSongBorn={setBornSong}
            />
          ))}
        </div>
      </section>
    </>
  );
};

export default SeedIdeasShelf;
