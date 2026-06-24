import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import type { MemoryCluster, MemorySong } from "@/lib/memory/memoryTypes";
import { CLUSTER_NOUN } from "./clusterIcon";

interface Props {
  cluster: MemoryCluster | null;
  songs: MemorySong[];
  onClose: () => void;
}

/** Bottom sheet showing the source trail — the songs a cluster connects. */
const MemorySourceSheet = ({ cluster, songs, onClose }: Props) => {
  const navigate = useNavigate();
  const open = cluster !== null;
  const connected = cluster ? songs.filter((s) => cluster.songIds.includes(s.id)) : [];

  return (
    <Drawer open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DrawerContent
        className="border-0"
        style={{ backgroundColor: "var(--cog-cream-light)" }}
      >
        <div
          className="px-6 pb-10 pt-2"
          style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
        >
          {cluster && (
            <>
              <DrawerTitle
                className="!font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", fontSize: "1.5rem" }}
              >
                {cluster.label}
              </DrawerTitle>
              <DrawerDescription className="mb-5" style={{ color: "var(--cog-warm-gray)" }}>
                {CLUSTER_NOUN[cluster.type]} · connected across {connected.length}{" "}
                {connected.length === 1 ? "song" : "songs"}
              </DrawerDescription>

              <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto">
                {connected.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => {
                      onClose();
                      navigate(`/songs/${song.id}/room`);
                    }}
                    className="w-full rounded-xl p-3.5 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.98]"
                    style={{ backgroundColor: "var(--cog-cream)", border: "1.5px solid var(--cog-border)" }}
                  >
                    <span
                      className="rounded-lg flex-shrink-0"
                      style={{ width: 34, height: 34, backgroundColor: song.coverColor ?? "var(--cog-gold-pale)" }}
                      aria-hidden
                    />
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                    >
                      {song.title}
                    </span>
                    <ArrowRight size={16} style={{ color: "var(--cog-muted)" }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MemorySourceSheet;
