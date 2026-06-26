import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { loadMemory } from "@/integrations/cog/memory";
import { buildSongMemory } from "@/lib/memory/buildGraph";
import type { MemoryCluster } from "@/lib/memory/memoryTypes";

const Chip = ({ cluster }: { cluster: MemoryCluster }) => {
  const accent = cluster.type === "person" && cluster.color ? cluster.color : "var(--cog-gold-alt)";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${cluster.type === "person" && cluster.color ? cluster.color : "var(--cog-gold)"}14`, color: accent, border: `1px solid ${cluster.type === "person" && cluster.color ? cluster.color : "var(--cog-gold)"}30` }}
    >
      {cluster.label}
    </span>
  );
};

const SongMemoryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "";

  const { data, isLoading, isError } = useQuery({ queryKey: ["memory"], queryFn: loadMemory });
  const songMemory = useMemo(
    () => (data?.graph ? buildSongMemory(data.graph, songId) : null),
    [data, songId],
  );

  const threads = songMemory
    ? [...songMemory.themes, ...songMemory.scriptures, ...songMemory.people]
    : [];

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      <div
        className="relative flex flex-col flex-1 px-6 pb-16"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="pt-14 pb-4">
          <button
            onClick={() => navigate(`/songs/${songId}/room`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--cog-gold-alt)" }}>
          Memory
        </p>
        <h1
          className="text-3xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          {songMemory?.song.title ?? "This song"}
        </h1>
        <p className="text-sm mb-7" style={{ color: "var(--cog-warm-gray)" }}>
          How this song connects to the rest of your writing.
        </p>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 rounded-2xl" style={{ backgroundColor: "var(--cog-cream-light)" }} />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm rounded-2xl p-4" role="alert" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
            We couldn't load Memory. Your song is safe — please try again.
          </p>
        )}

        {!isLoading && !isError && songMemory && (
          <>
            {threads.length > 0 && (
              <div className="mb-7">
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--cog-warm-gray)" }}>
                  In this song
                </h2>
                <div className="flex flex-wrap gap-2">
                  {threads.map((c) => (
                    <Chip key={c.id} cluster={c} />
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--cog-warm-gray)" }}>
              Connected songs
            </h2>
            {songMemory.related.length === 0 ? (
              <p className="text-sm rounded-2xl p-4" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
                Nothing connects yet. As you reuse a theme or scripture, related songs will appear here.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {songMemory.related.map((rel) => (
                  <button
                    key={rel.songId}
                    onClick={() => navigate(`/songs/${rel.songId}/room`)}
                    className="w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98]"
                    style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)", boxShadow: "var(--cog-shadow-sm)" }}
                  >
                    <span
                      className="rounded-lg flex-shrink-0"
                      style={{ width: 36, height: 36, backgroundColor: rel.coverColor ?? "var(--cog-gold-pale)" }}
                      aria-hidden
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                        {rel.title}
                      </span>
                      <span className="block text-xs truncate" style={{ color: "var(--cog-warm-gray)" }}>
                        {rel.reasons.join(" · ")}
                      </span>
                    </span>
                    <ArrowRight size={16} style={{ color: "var(--cog-muted)" }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && !isError && !songMemory && (
          <p className="text-sm rounded-2xl p-4" style={{ backgroundColor: "var(--cog-cream-light)", color: "var(--cog-warm-gray)" }}>
            This song isn't in your memory yet.
          </p>
        )}

        {!isLoading && !isError && (
          <button
            onClick={() => navigate("/memory")}
            className="w-full mt-7 py-4 rounded-2xl font-medium text-base transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
            }}
          >
            <span className="flex items-center justify-center gap-2">
              Open your full memory
              <ArrowRight size={16} style={{ color: "var(--cog-warm-gray)" }} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SongMemoryPage;
