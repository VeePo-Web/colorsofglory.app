import { Music, Lightbulb, Quote, ArrowRight } from "lucide-react";
import type { MemoryCluster } from "@/lib/memory/memoryTypes";
import type { MemorySearchHit, MemorySearchResults as Results } from "@/lib/memory/searchMemory";
import { ClusterIcon } from "./clusterIcon";

interface Props {
  results: Results;
  onOpenCluster: (c: MemoryCluster) => void;
  onOpenSong: (songId: string) => void;
}

function HitIcon({ hit }: { hit: MemorySearchHit }) {
  if (hit.kind === "song") return <Music size={16} strokeWidth={1.8} />;
  if (hit.kind === "idea") return <Lightbulb size={16} strokeWidth={1.8} />;
  if (hit.kind === "lyric") return <Quote size={16} strokeWidth={1.8} />;
  return <ClusterIcon type={hit.kind} />;
}

const HitRow = ({ hit, onOpenCluster, onOpenSong }: { hit: MemorySearchHit } & Pick<Props, "onOpenCluster" | "onOpenSong">) => {
  const accent = hit.kind === "person" && hit.cluster?.color ? hit.cluster.color : "var(--cog-gold-alt)";
  const tint = hit.kind === "person" && hit.cluster?.color ? hit.cluster.color : "var(--cog-gold)";
  return (
    <button
      onClick={() => {
        if (hit.cluster) onOpenCluster(hit.cluster);
        else if (hit.songId) onOpenSong(hit.songId);
      }}
      className="w-full rounded-xl p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98]"
      style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
    >
      <span
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 34, height: 34, backgroundColor: `${tint}14`, color: accent }}
      >
        <HitIcon hit={hit} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
          {hit.label}
        </span>
        {hit.sublabel && (
          <span className="block text-xs truncate" style={{ color: "var(--cog-warm-gray)" }}>
            {hit.sublabel}
          </span>
        )}
      </span>
      <ArrowRight size={15} style={{ color: "var(--cog-muted)" }} />
    </button>
  );
};

const Group = ({ title, hits, ...handlers }: { title: string; hits: MemorySearchHit[] } & Pick<Props, "onOpenCluster" | "onOpenSong">) => {
  if (hits.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--cog-warm-gray)" }}>
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {hits.map((h) => (
          <HitRow key={`${h.kind}:${h.id}`} hit={h} {...handlers} />
        ))}
      </div>
    </div>
  );
};

/** Recall view: grouped hits across songs, ideas, themes, scripture, people. */
const MemorySearchResults = ({ results, onOpenCluster, onOpenSong }: Props) => {
  if (results.total === 0) {
    return (
      <p className="text-sm rounded-2xl p-4" role="status" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
        Nothing yet for “{results.query.trim()}”. Try a theme, a name, or a line you remember.
      </p>
    );
  }
  return (
    <div>
      <Group title="Songs" hits={results.songs} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
      <Group title="Lyrics" hits={results.lyrics} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
      <Group title="Ideas" hits={results.ideas} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
      <Group title="Themes" hits={results.themes} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
      <Group title="Scripture" hits={results.scriptures} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
      <Group title="People" hits={results.people} onOpenCluster={onOpenCluster} onOpenSong={onOpenSong} />
    </div>
  );
};

export default MemorySearchResults;
