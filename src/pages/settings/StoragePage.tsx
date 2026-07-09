import { useNavigate } from "react-router-dom";
import { HardDrive } from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import { useStorageUsage } from "@/hooks/useAppQueries";

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

type LoadState = "loading" | "ready" | "unavailable";

const StoragePage = () => {
  const navigate = useNavigate();

  // Storage read via TanStack Query. Fails soft: a failed read resolves to the
  // calm "unavailable" copy, never a blocking modal — the songs are safe either
  // way, and a gentle retry runs behind the scenes.
  const storageQuery = useStorageUsage();
  const usedBytes = storageQuery.data?.bytesUsed ?? 0;
  const limitBytes = storageQuery.data?.bytesLimit ?? 0;
  const state: LoadState = storageQuery.isLoading
    ? "loading"
    : storageQuery.isError
      ? "unavailable"
      : "ready";

  const percent =
    limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const nearFull = state === "ready" && percent >= 80;
  const accent = nearFull ? "#E15E39" : "var(--cog-gold)";

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <BackHeader label="Settings" fallback="/settings" />

      <div
        className="relative flex flex-col flex-1 px-6 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="flex justify-center mb-6 pt-2">
          <CogBrand variant="stacked" size="sm" />
        </div>

        {/* Icon — calm gold normally, coral only when actually near full */}
        <div
          className="flex items-center justify-center rounded-full mx-auto mb-6"
          style={{
            width: 64,
            height: 64,
            backgroundColor: nearFull ? "rgba(225,94,57,0.10)" : "rgba(184,149,58,0.12)",
            border: `1.5px solid ${nearFull ? "rgba(225,94,57,0.25)" : "rgba(184,149,58,0.25)"}`,
          }}
        >
          <HardDrive size={28} strokeWidth={1.5} style={{ color: accent }} />
        </div>

        <h1
          className="text-3xl font-semibold mb-2 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          {nearFull ? "You're almost out of storage" : "Your storage"}
        </h1>
        <p
          className="text-base text-center mb-8"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          {nearFull
            ? "Your songs are safe, but new uploads may pause soon."
            : "Every idea you capture lives safely here."}
        </p>

        {/* Storage bar */}
        <div
          className="rounded-2xl p-5 mb-8"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              {state === "loading"
                ? "Checking your space…"
                : state === "unavailable"
                ? "Storage usage unavailable"
                : `${formatBytes(usedBytes)} of ${formatBytes(limitBytes)} used`}
            </span>
            {state === "ready" && (
              <span className="text-sm font-semibold" style={{ color: accent, fontFamily: "var(--font-body)" }}>
                {percent}% used
              </span>
            )}
          </div>

          {/* Bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 12, backgroundColor: "var(--cog-gold-pale)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${state === "ready" ? percent : 0}%`,
                background: nearFull
                  ? "linear-gradient(90deg, var(--cog-gold) 0%, #E15E39 100%)"
                  : "var(--cog-gold)",
              }}
            />
          </div>
        </div>

        {/* CTAs */}
        <button
          onClick={() => navigate("/upgrade")}
          className="w-full rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-3"
          style={{
            minHeight: 52,
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          {nearFull ? "Add storage" : "Upgrade for more space"}
        </button>

        {/* Calm footer note */}
        <p
          className="text-xs text-center mt-4"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)", lineHeight: 1.6 }}
        >
          Your songs, lyrics, and memos are never deleted — only new uploads pause if you run out.
        </p>
      </div>
      <BottomNav active="settings" />
    </div>
  );
};

export default StoragePage;
