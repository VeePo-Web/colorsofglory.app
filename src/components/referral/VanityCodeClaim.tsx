import { useState } from "react";
import { toast } from "sonner";
import { claimReferralCode, buildReferralShareUrl } from "@/integrations/cog/referrals";

/**
 * VanityCodeClaim — claim a memorable /r/<name> referral code.
 *
 * Surfaces the existing claimReferralCode RPC (3–20 chars, A–Z/0–9; the DB
 * trigger keeps the /r/:code resolver in sync). Collapsed to a quiet one-line
 * affordance under the link card; expands to a small input + claim button.
 * On success the parent refreshes so the new code flows into the share link
 * everywhere (dashboard + in-song prompts).
 */
interface VanityCodeClaimProps {
  /** The user's current code (null until one exists). */
  currentCode: string | null;
  /** Called with the newly claimed code so the parent can refresh its stats. */
  onClaimed: (code: string) => void;
}

const CODE_RE = /^[A-Za-z0-9]{3,20}$/;

const ERROR_COPY: Record<string, string> = {
  code_taken: "That code is taken — try another.",
  invalid_code: "Codes are 3–20 letters or numbers.",
};

const VanityCodeClaim = ({ currentCode, onClaimed }: VanityCodeClaimProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = value.trim().toUpperCase();
  const valid = CODE_RE.test(normalized);

  const handleClaim = async () => {
    if (!valid || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const claimed = await claimReferralCode(normalized);
      onClaimed(claimed);
      setEditing(false);
      setValue("");
      toast.success(`Your link is now ${buildReferralShareUrl(claimed).replace("https://", "")}`);
    } catch (err) {
      const raw = (err as Error)?.message ?? "";
      setError(ERROR_COPY[raw] ?? "Couldn't claim that code. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(""); setError(null); setEditing(true); }}
        className="text-xs transition-opacity hover:opacity-70 mt-3"
        style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
      >
        {currentCode ? "Choose a custom code" : "Claim a custom code"}
      </button>
    );
  }

  return (
    <div className="mt-4">
      <label
        htmlFor="vanity-code-input"
        className="text-xs font-medium uppercase tracking-wider block mb-2"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        Pick a memorable code
      </label>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center rounded-xl px-3"
          style={{ backgroundColor: "var(--cog-cream)", border: "1px solid var(--cog-border)", height: 44 }}
        >
          <span className="text-sm flex-shrink-0" style={{ color: "var(--cog-muted)", fontFamily: "monospace" }}>
            /r/
          </span>
          <input
            id="vanity-code-input"
            type="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleClaim(); }}
            placeholder="YOURNAME"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            style={{ color: "var(--cog-charcoal)", fontFamily: "monospace", textTransform: "uppercase" }}
          />
        </div>
        <button
          type="button"
          onClick={handleClaim}
          disabled={!valid || claiming}
          className="rounded-xl px-4 text-sm font-semibold text-white flex-shrink-0 transition-all duration-150 active:scale-95"
          style={{
            height: 44,
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            opacity: !valid || claiming ? 0.6 : 1,
          }}
        >
          {claiming ? "Claiming…" : "Claim"}
        </button>
      </div>
      {error ? (
        <p className="text-xs mt-2" style={{ color: "#E05440", fontFamily: "var(--font-body)" }} role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs mt-2" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          3–20 letters or numbers. Your old links keep working.
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs mt-2 transition-opacity hover:opacity-70"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        Cancel
      </button>
    </div>
  );
};

export default VanityCodeClaim;
