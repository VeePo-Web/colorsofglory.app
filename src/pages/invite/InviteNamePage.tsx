import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { saveInviteContext } from "@/lib/invite/inviteContext";
import { enterInvitedSong } from "@/lib/invite/enterSong";
import { saveName } from "@/lib/invite/inviteApi";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

const fieldStyle = (active: boolean): React.CSSProperties => ({
  height: 56,
  backgroundColor: '#FFFFFF',
  border: active ? '1.5px solid var(--cog-gold)' : '1.5px solid rgba(0,0,0,0.10)',
  boxShadow: active ? '0 0 0 3px rgba(184,149,58,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
  color: 'var(--cog-charcoal)',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border 150ms, box-shadow 150ms',
  caretColor: 'var(--cog-gold)',
  borderRadius: 14,
  width: '100%',
  padding: '0 16px',
  textAlign: 'center',
});

/**
 * Screen C — the one question between the code and the song.
 * ONE field (iOS contact autofill completes it in a tap), then straight into
 * the room. First/last split happens here, not on the writer.
 */
const InviteNamePage = () => {
  const navigate = useNavigate();
  // While they type their name, fetch the song room so continue is instant.
  useIdlePrefetch(() => import("@/pages/SongCanvasPage"));

  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const trimmed = name.trim();
  const canContinue = trimmed.length >= 2;

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSaving(true);
    setError(null);
    const [firstName, ...rest] = trimmed.split(/\s+/);
    const lastName = rest.join(' ');
    try {
      await saveName(firstName, lastName);
      saveInviteContext({ firstName, lastName });
      enterInvitedSong(navigate);
    } catch {
      setError("We could not save your name. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingShell>
      {/* Logo */}
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--cog-charcoal)' }}
      >
        What's your name?
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: 'var(--cog-warm-gray)' }}>
        Your collaborators will see this in the song.
      </p>

      {/* THE one field */}
      <div className="mb-8">
        <label htmlFor="full-name" className="sr-only">
          Your name
        </label>
        <input
          id="full-name"
          type="text"
          autoComplete="name"
          autoFocus
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) handleContinue(); }}
          placeholder="First and last name"
          aria-required="true"
          style={fieldStyle(focused || !!name)}
        />
      </div>

      {error && (
        <p className="text-sm text-center mb-4" style={{ color: '#B4543F' }} role="alert">
          {error}
        </p>
      )}

      <GoldButton
        disabled={!canContinue}
        loading={isSaving}
        loadingText="Saving..."
        onClick={handleContinue}
      >
        Continue to the song →
      </GoldButton>
    </OnboardingShell>
  );
};

export default InviteNamePage;
