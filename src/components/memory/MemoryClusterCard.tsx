import type { MemoryCluster } from "@/lib/memory/memoryTypes";
import { ClusterIcon, CLUSTER_NOUN } from "./clusterIcon";

interface Props {
  cluster: MemoryCluster;
  onOpen: (cluster: MemoryCluster) => void;
}

/**
 * Mobile-first memory unit: a calm cluster card, never a graph node.
 * Tapping opens a bottom sheet of the connected songs (the source trail).
 */
const MemoryClusterCard = ({ cluster, onOpen }: Props) => {
  const accent = cluster.type === "person" && cluster.color ? cluster.color : "var(--cog-gold)";

  return (
    <button
      onClick={() => onOpen(cluster)}
      className="w-full rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.98]"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: cluster.recurring ? "1.5px solid var(--cog-border-gold)" : "1.5px solid var(--cog-border)",
        boxShadow: "var(--cog-shadow-sm)",
        minHeight: 64,
      }}
      aria-label={`${CLUSTER_NOUN[cluster.type]}: ${cluster.label}, connected to ${cluster.count} ${cluster.count === 1 ? "song" : "songs"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 40, height: 40, backgroundColor: `${accent}1A`, color: accent }}
        >
          {cluster.type === "person" ? (
            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
              {cluster.label.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <ClusterIcon type={cluster.type} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-base font-semibold truncate"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          >
            {cluster.label}
          </p>
          <p className="text-xs" style={{ color: "var(--cog-warm-gray)" }}>
            {CLUSTER_NOUN[cluster.type]} · {cluster.count} {cluster.count === 1 ? "song" : "songs"}
          </p>
        </div>

        {cluster.recurring && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
            style={{ backgroundColor: "var(--cog-gold-pale)", color: "var(--cog-gold-alt)" }}
          >
            Recurring
          </span>
        )}
      </div>
    </button>
  );
};

export default MemoryClusterCard;
