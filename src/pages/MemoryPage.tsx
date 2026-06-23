import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import { loadMemory } from "@/integrations/cog/memory";
import type { MemoryCluster } from "@/lib/memory/memoryTypes";
import MemoryClusterCard from "@/components/memory/MemoryClusterCard";
import MemorySourceSheet from "@/components/memory/MemorySourceSheet";
import ObsidianExportSheet from "@/components/memory/ObsidianExportSheet";

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div className="flex-1 text-center">
    <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
      {value}
    </p>
    <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--cog-muted)" }}>
      {label}
    </p>
  </div>
);

const Section = ({ title, clusters, onOpen }: { title: string; clusters: MemoryCluster[]; onOpen: (c: MemoryCluster) => void }) => {
  if (clusters.length === 0) return null;
  return (
    <div className="mb-7">
      <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--cog-warm-gray)" }}>
        {title}
      </h2>
      <div className="flex flex-col gap-2.5">
        {clusters.map((c) => (
          <MemoryClusterCard key={c.id} cluster={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
};

const MemoryPage = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<MemoryCluster | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ["memory"], queryFn: loadMemory });
  const graph = data?.graph ?? null;

  const recurring = useMemo(() => graph?.clusters.filter((c) => c.recurring) ?? [], [graph]);
  const single = useMemo(() => graph?.clusters.filter((c) => !c.recurring) ?? [], [graph]);
  const hasSongs = (graph?.stats.songCount ?? 0) > 0;

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      <div
        className="relative flex flex-col flex-1 px-6 pb-16"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="pt-14 pb-4">
          <button
            onClick={() => navigate("/songs")}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Songs
          </button>
        </div>

        <div className="flex justify-center mb-5">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Your Memory
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--cog-warm-gray)" }}>
          A private map of your songs, ideas, themes, and scripture. It grows as you write.
        </p>

        {isLoading && (
          <div className="space-y-3" aria-label="Building your memory map">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl" style={{ backgroundColor: "var(--cog-cream-light)" }} />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm rounded-2xl p-4" role="alert" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
            We couldn't load Memory. Your songs are safe — please try again.
          </p>
        )}

        {!isLoading && !isError && graph && (
          <>
            {!hasSongs ? (
              <div
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
              >
                <p className="text-base font-medium mb-1" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                  Your memory will build as you write.
                </p>
                <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                  Songs, ideas, and scripture will connect here over time.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex rounded-2xl py-4 mb-7"
                  style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
                >
                  <Stat value={graph.stats.songCount} label="Songs" />
                  <Stat value={graph.stats.themeCount} label="Themes" />
                  <Stat value={graph.stats.scriptureCount} label="Scripture" />
                  <Stat value={graph.stats.personCount} label="People" />
                </div>

                {graph.clusters.length === 0 ? (
                  <p className="text-sm rounded-2xl p-4 mb-6" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
                    Add tags or a scripture to an idea and your memory will start connecting songs.
                  </p>
                ) : (
                  <>
                    <Section title="Recurring across your songs" clusters={recurring} onOpen={setActive} />
                    <Section title="Threads" clusters={single} onOpen={setActive} />
                  </>
                )}

                <button
                  onClick={() => setExportOpen(true)}
                  className="w-full py-4 rounded-2xl font-medium text-base transition-all duration-150 active:scale-[0.97]"
                  style={{
                    backgroundColor: "var(--cog-cream-light)",
                    border: "1.5px solid var(--cog-border)",
                    color: "var(--cog-charcoal)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <FileText size={16} strokeWidth={1.8} style={{ color: "var(--cog-warm-gray)" }} />
                    Export to Obsidian
                  </span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      <MemorySourceSheet cluster={active} songs={graph?.songs ?? []} onClose={() => setActive(null)} />
      <ObsidianExportSheet open={exportOpen} graph={graph} bundle={data?.bundle ?? null} onClose={() => setExportOpen(false)} />
    </div>
  );
};

export default MemoryPage;
