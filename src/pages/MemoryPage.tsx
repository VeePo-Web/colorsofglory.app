import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, FileText, Search, X, RotateCcw } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import { loadMemory } from "@/integrations/cog/memory";
import { searchMemory } from "@/lib/memory/searchMemory";
import { applyHidden, toggleHidden, loadHiddenIds, saveHiddenIds } from "@/lib/memory/hidden";
import { buildInsights } from "@/lib/memory/insights";
import { loadMemorySnapshot } from "@/lib/memory/localCache";
import { freshSongs, loadLastSeen, saveLastSeen } from "@/lib/memory/recency";
import { resumePathFor } from "@/lib/nav/songResume";
import type { MemoryCluster } from "@/lib/memory/memoryTypes";
import MemoryClusterCard from "@/components/memory/MemoryClusterCard";
import MemorySearchResults from "@/components/memory/MemorySearchResults";
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
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<string[]>(() => loadHiddenIds());

  // Local-first: the last snapshot renders in ~0ms while the fetch revalidates.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["memory"],
    queryFn: loadMemory,
    placeholderData: () => loadMemorySnapshot(),
  });
  const graph = data?.graph ?? null;

  // "New since you last opened" — capture the prior visit, then stamp this one.
  const userId = graph?.userId ?? null;
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const seenCaptured = useRef(false);
  useEffect(() => {
    if (!userId || seenCaptured.current) return;
    seenCaptured.current = true;
    setSeenAt(loadLastSeen(userId));
    saveLastSeen(userId, new Date().toISOString());
  }, [userId]);
  const fresh = useMemo(() => (graph ? freshSongs(graph.songs, seenAt) : []), [graph, seenAt]);

  // "Your writing, by the numbers" — word/scripture recurrence across everything.
  const insights = useMemo(() => (data?.bundle ? buildInsights(data.bundle) : null), [data?.bundle]);

  const recurring = useMemo(() => applyHidden(graph?.clusters.filter((c) => c.recurring) ?? [], hidden), [graph, hidden]);
  const single = useMemo(() => applyHidden(graph?.clusters.filter((c) => !c.recurring) ?? [], hidden), [graph, hidden]);
  const hiddenCount = useMemo(() => (graph ? graph.clusters.filter((c) => hidden.includes(c.id)).length : 0), [graph, hidden]);
  const hasSongs = (graph?.stats.songCount ?? 0) > 0;

  const searching = query.trim().length > 0;
  // Defer result computation off the keystroke path — typing stays at 60fps
  // even on a large catalog; results catch up a frame later.
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => {
    if (!graph || !data?.bundle || deferredQuery.trim().length === 0) return null;
    const r = searchMemory(graph, data.bundle, deferredQuery);
    return {
      ...r,
      themes: applyHidden(r.themes, hidden),
      scriptures: applyHidden(r.scriptures, hidden),
      people: applyHidden(r.people, hidden),
    };
  }, [graph, data?.bundle, deferredQuery, hidden]);
  // Open a song capture-first (the app's front door), resuming the last
  // surface if there is one — the same rule the catalog uses. The module
  // hub stays a deliberate tap ("Open room"), never a forced landing.
  const openSong = (id: string) => navigate(resumePathFor(id) ?? `/songs/${id}/brainstorm`);

  const persistHidden = (next: string[]) => {
    setHidden(next);
    saveHiddenIds(next);
  };
  const hideCluster = (id: string) => {
    const before = hidden;
    persistHidden(toggleHidden(before, id));
    setActive(null);
    toast("Hidden from Memory", { action: { label: "Undo", onClick: () => persistHidden(before) } });
  };
  const restoreAll = () => {
    persistHidden([]);
    toast("Restored hidden items");
  };

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
                {/* Search Memory — the F33 primary action: instant recall */}
                <div className="relative mb-6">
                  <Search
                    size={17}
                    strokeWidth={1.8}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--cog-muted)" }}
                  />
                  <input
                    type="text"
                    inputMode="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your memory"
                    aria-label="Search your memory"
                    className="w-full rounded-2xl py-3.5 pl-11 pr-10 text-base outline-none"
                    style={{
                      backgroundColor: "var(--cog-cream-light)",
                      border: "1.5px solid var(--cog-border)",
                      color: "var(--cog-charcoal)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  {searching && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full"
                      style={{ width: 32, height: 32, color: "var(--cog-warm-gray)" }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {searching && results ? (
                  <MemorySearchResults results={results} onOpenCluster={setActive} onOpenSong={openSong} />
                ) : (
                  <>
                    {fresh.length > 0 && (
                      <div className="mb-7">
                        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--cog-warm-gray)" }}>
                          New since you last opened
                        </h2>
                        <div className="flex flex-col gap-2.5">
                          {fresh.slice(0, 5).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => openSong(s.id)}
                              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
                              style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border-gold)" }}
                            >
                              <span className="flex-shrink-0 rounded-full" style={{ width: 10, height: 10, backgroundColor: s.coverColor || "var(--cog-gold)" }} />
                              <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                {s.title}
                              </span>
                              <ArrowRight size={15} style={{ color: "var(--cog-muted)" }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {insights && (insights.topWords.length > 0 || insights.scriptures.length > 0 || insights.collaborators.length > 0 || insights.keys.length > 0 || insights.tempo || insights.cadence) && (
                      <div className="mb-7">
                        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--cog-warm-gray)" }}>
                          Your writing, by the numbers
                        </h2>
                        {insights.topWords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {insights.topWords.slice(0, 8).map((w) => (
                              <span
                                key={w.word}
                                className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full text-sm"
                                style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
                              >
                                <span style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)", fontWeight: 500 }}>
                                  {w.word}
                                </span>
                                <span className="text-xs" style={{ color: "var(--cog-gold-alt)" }}>
                                  {w.count}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {insights.scriptures.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {insights.scriptures.slice(0, 5).map((s) => (
                              <div key={s.label} className="flex items-baseline justify-between px-1">
                                <span className="text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                  {s.label}
                                </span>
                                <span className="text-xs" style={{ color: "var(--cog-warm-gray)" }}>
                                  {s.count} {s.count === 1 ? "mention" : "mentions"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(insights.collaborators.length > 0 || insights.keys.length > 0 || insights.tempo || insights.cadence) && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            {insights.collaborators.slice(0, 4).map((c) => (
                              <div key={`collab-${c.label}`} className="flex items-baseline justify-between px-1">
                                <span className="text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                  Written with {c.label}
                                </span>
                                <span className="text-xs" style={{ color: "var(--cog-warm-gray)" }}>
                                  {c.count} {c.count === 1 ? "song" : "songs"}
                                </span>
                              </div>
                            ))}
                            {insights.keys.length > 0 && (
                              <div className="flex items-baseline justify-between px-1">
                                <span className="text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                  Keys you write in
                                </span>
                                <span className="text-xs truncate ml-3" style={{ color: "var(--cog-warm-gray)" }}>
                                  {insights.keys.map((k) => k.label).join(" · ")}
                                </span>
                              </div>
                            )}
                            {insights.tempo && (
                              <div className="flex items-baseline justify-between px-1">
                                <span className="text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                  Tempo
                                </span>
                                <span className="text-xs ml-3" style={{ color: "var(--cog-warm-gray)" }}>
                                  {insights.tempo.min === insights.tempo.max
                                    ? `${insights.tempo.average} BPM`
                                    : `${insights.tempo.min}–${insights.tempo.max} BPM · avg ${insights.tempo.average}`}
                                </span>
                              </div>
                            )}
                            {insights.cadence && (
                              <div className="flex items-baseline justify-between px-1">
                                <span className="text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                                  Most productive
                                </span>
                                <span className="text-xs ml-3 truncate" style={{ color: "var(--cog-warm-gray)" }}>
                                  {insights.cadence.busiest.label} · {insights.cadence.busiest.count} {insights.cadence.busiest.count === 1 ? "song" : "songs"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs mt-3" style={{ color: "var(--cog-muted)" }}>
                          {insights.totals.wordsWritten.toLocaleString()} words written ({insights.totals.uniqueWords.toLocaleString()} unique) across {insights.totals.lyricLines.toLocaleString()} lyric lines.
                        </p>
                      </div>
                    )}

                    {hiddenCount > 0 && (
                      <button
                        onClick={restoreAll}
                        className="w-full mb-3 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-150 active:scale-[0.98]"
                        style={{ color: "var(--cog-warm-gray)", border: "1.5px dashed var(--cog-border)" }}
                      >
                        <RotateCcw size={15} strokeWidth={1.8} />
                        Restore {hiddenCount} hidden {hiddenCount === 1 ? "item" : "items"}
                      </button>
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
          </>
        )}
      </div>

      <MemorySourceSheet cluster={active} songs={graph?.songs ?? []} onClose={() => setActive(null)} onHide={hideCluster} />
      <ObsidianExportSheet open={exportOpen} graph={graph} bundle={data?.bundle ?? null} onClose={() => setExportOpen(false)} />
    </div>
  );
};

export default MemoryPage;
