import { Plus } from "lucide-react";

interface EmptyLibraryHeroProps {
  onStart: () => void;
  checking?: boolean;
}

/**
 * EmptyLibraryHero — the PV11 empty Owned state, treated as an invitation
 * rather than an absence: serif headline, the signature warm glow, one gold
 * action. "The catalog should feel like a creative universe" starts here,
 * before the first song exists.
 */
const EmptyLibraryHero = ({ onStart, checking = false }: EmptyLibraryHeroProps) => (
  <div className="relative overflow-hidden rounded-3xl px-6 pb-12 pt-14 text-center">
    {/* Warm radial glow behind the invitation */}
    <div aria-hidden className="cog-glow pointer-events-none absolute inset-0" />

    <div className="relative z-10 mx-auto max-w-[300px]">
      <h2
        className="font-bold leading-tight"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--cog-charcoal)",
          fontSize: "clamp(1.625rem, 6vw, 2rem)",
        }}
      >
        Your first song lives here
      </h2>
      <p
        className="mt-3 text-[0.9375rem] leading-relaxed"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        One private room for its lyrics, voice memos, chords, and the people you
        write with.
      </p>
      <button
        onClick={onStart}
        disabled={checking}
        aria-busy={checking}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-7 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--cog-gold-light)] active:scale-95 disabled:opacity-80 bg-[var(--cog-gold)]"
        style={{
          minHeight: 52,
          fontFamily: "var(--font-body)",
          fontSize: "0.9375rem",
          boxShadow: "0 10px 26px -8px rgba(184,149,58,0.55)",
        }}
      >
        <Plus size={16} strokeWidth={2.5} />
        {checking ? "Checking..." : "Start your first song"}
      </button>
    </div>
  </div>
);

export default EmptyLibraryHero;
