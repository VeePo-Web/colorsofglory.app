import { useNavigate } from "react-router-dom";
import { ArrowLeft, HardDrive } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

interface StorageItem {
  label: string;
  used: string;
  bytes: number;
}

const STORAGE_ITEMS: StorageItem[] = [
  { label: "Voice memos", used: "620MB", bytes: 620 },
  { label: "Song files", used: "180MB", bytes: 180 },
  { label: "Exports", used: "50MB", bytes: 50 },
];

const TOTAL_GB = 1000; // 1GB in MB
const USED_MB = 850;
const USED_PERCENT = Math.round((USED_MB / TOTAL_GB) * 100);

const StoragePage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogLogo size="sm" />
        </div>

        {/* Warning icon */}
        <div
          className="flex items-center justify-center rounded-full mx-auto mb-6"
          style={{
            width: 64,
            height: 64,
            backgroundColor: "rgba(225,94,57,0.10)",
            border: "1.5px solid rgba(225,94,57,0.25)",
          }}
        >
          <HardDrive size={28} strokeWidth={1.5} style={{ color: "#E15E39" }} />
        </div>

        <h1
          className="text-3xl font-semibold mb-2 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          You are almost out of storage
        </h1>
        <p
          className="text-base text-center mb-8"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Your songs are safe, but new uploads may pause soon.
        </p>

        {/* Storage bar */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              850MB of 1GB used
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: "#E15E39", fontFamily: "var(--font-body)" }}
            >
              {USED_PERCENT}% used
            </span>
          </div>

          {/* Bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 12,
              backgroundColor: "var(--cog-gold-pale)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${USED_PERCENT}%`,
                background: "linear-gradient(90deg, var(--cog-gold) 0%, #E15E39 100%)",
              }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Breakdown
        </h2>
        <div className="flex flex-col gap-2.5 mb-8">
          {STORAGE_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1.5px solid var(--cog-border)",
              }}
            >
              <p
                className="text-sm font-medium"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                {item.label}
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                {item.used}
              </p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <button
          onClick={() => navigate("/upgrade")}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-3"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          Add storage
        </button>

        <button
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70 mb-8"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Manage files
        </button>

        {/* Calm footer note */}
        <p
          className="text-xs text-center"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)", lineHeight: 1.6 }}
        >
          Your songs, lyrics, and memos will not be deleted.{"\n"}Only new uploads pause.
        </p>
      </div>
    </div>
  );
};

export default StoragePage;
