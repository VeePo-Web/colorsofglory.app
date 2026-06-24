import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, FolderOpen, Link2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { downloadVault } from "@/integrations/cog/memory";
import type { MemoryGraph, MemoryRawBundle } from "@/lib/memory/memoryTypes";

interface Props {
  open: boolean;
  graph: MemoryGraph | null;
  bundle: MemoryRawBundle | null;
  onClose: () => void;
}

const STEPS = [
  { icon: Download, text: "Download the vault — a folder of notes, zipped." },
  { icon: FolderOpen, text: "Unzip it, then in Obsidian choose “Open folder as vault.”" },
  { icon: Link2, text: "Your songs, themes, and scripture link themselves." },
];

/**
 * One-click Obsidian vault export. Generated entirely in the browser — no
 * server, no per-user sync fees, no Obsidian runtime dependency (F33 rule).
 * The vault is yours: portable, plain Markdown, no vendor lock-in.
 */
const ObsidianExportSheet = ({ open, graph, bundle, onClose }: Props) => {
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    if (!graph || !bundle) return;
    setBusy(true);
    try {
      downloadVault(graph, bundle);
      toast.success("Memory vault exported");
    } catch {
      toast.error("Could not export your vault. Your songs are safe — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DrawerContent className="border-0" style={{ backgroundColor: "var(--cog-cream-light)" }}>
        <div className="px-6 pb-10 pt-2" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}>
          <DrawerTitle
            className="!font-semibold flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", fontSize: "1.5rem" }}
          >
            <FileText size={20} style={{ color: "var(--cog-gold)" }} />
            Export to Obsidian
          </DrawerTitle>
          <DrawerDescription className="mb-5" style={{ color: "var(--cog-warm-gray)" }}>
            Take your memory anywhere. Plain Markdown you fully own.
          </DrawerDescription>

          <div className="flex flex-col gap-3 mb-7">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 32, height: 32, backgroundColor: "var(--cog-gold-glow)", color: "var(--cog-gold-alt)" }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <p className="text-sm pt-1.5" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={busy || !graph}
            className="w-full py-4 rounded-2xl font-semibold text-base transition-all duration-150 active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)" }}
          >
            <span className="flex items-center justify-center gap-2">
              <Download size={17} strokeWidth={2} />
              {busy ? "Preparing…" : "Download vault"}
            </span>
          </button>

          <p className="text-xs text-center mt-3" style={{ color: "var(--cog-muted)" }}>
            Obsidian is free. We never charge for sync — the vault lives on your own device.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ObsidianExportSheet;
