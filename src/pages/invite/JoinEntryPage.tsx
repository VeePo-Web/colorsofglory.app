import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";

/**
 * Join entry — for someone who chose "Join a song" or has an invite link/code
 * but opened the app fresh (instead of tapping the link directly).
 *
 * Most invitees arrive via colorsofglory.app/join/:token and skip this screen
 * entirely. This is the graceful fallback: paste the link, or type the code,
 * and we route into the real /join/:token flow.
 */

/** Pull a usable invite token out of a pasted link or a raw code. */
export function parseInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If they pasted a URL, take the segment after /join/ or /invite/.
  const match = trimmed.match(/(?:join|invite)\/([^/?#\s]+)/i);
  if (match?.[1]) return match[1];

  // Otherwise treat the whole thing as the code — but reject anything that
  // still looks like a URL we couldn't parse (avoids sending junk to preview).
  if (/^https?:|\//i.test(trimmed)) return null;

  // Strip any stray query/hash a bare code might carry.
  const bare = trimmed.split(/[?#\s]/)[0];
  return bare.length > 0 ? bare : null;
}

const fieldStyle = (active: boolean): React.CSSProperties => ({
  height: 56,
  width: "100%",
  padding: "0 16px",
  borderRadius: 14,
  backgroundColor: "#FFFFFF",
  border: active ? "1.5px solid #B5935A" : "1.5px solid rgba(0,0,0,0.10)",
  boxShadow: active ? "0 0 0 3px rgba(181,147,90,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
  color: "#1A1A1A",
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  outline: "none",
  transition: "border 150ms, box-shadow 150ms",
  caretColor: "#B5935A",
});

const JoinEntryPage = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = parseInviteToken(value);
  const canContinue = token !== null;

  const handleContinue = () => {
    if (!token) {
      setError("That doesn't look like a valid invite. Paste the full link or the code.");
      return;
    }
    navigate(`/join/${encodeURIComponent(token)}`);
  };

  return (
    <OnboardingShell>
      {/* Back */}
      <div className="pt-14 pb-2">
        <button
          onClick={() => navigate("/onboarding/intent")}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "#999", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
      </div>

      {/* Logo */}
      <div className="pb-8 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Join a song
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        Paste the invite link a friend sent you, or enter the code.
      </p>

      {/* Input */}
      <div className="mb-3">
        <label
          htmlFor="invite-code"
          className="block text-[0.875rem] font-medium mb-2"
          style={{ color: "#666" }}
        >
          Invite link or code
        </label>
        <input
          id="invite-code"
          type="text"
          inputMode="text"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canContinue) handleContinue();
          }}
          placeholder="colorsofglory.app/join/…"
          aria-describedby="invite-error"
          style={fieldStyle(focused || value.length > 0)}
        />
      </div>

      {error && (
        <p
          id="invite-error"
          className="text-sm text-center mb-4"
          style={{ color: "#E05440" }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <div className="mt-2">
        <GoldButton disabled={!canContinue} onClick={handleContinue}>
          Continue
        </GoldButton>
      </div>

      <p className="text-[0.8125rem] text-center mt-4" style={{ color: "#999" }}>
        Invited songs don't use your free song.
      </p>
    </OnboardingShell>
  );
};

export default JoinEntryPage;
