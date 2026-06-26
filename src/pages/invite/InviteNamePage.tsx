import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { loadInviteContext, saveInviteContext } from "@/lib/invite/inviteContext";
import { saveName } from "@/lib/invite/inviteApi";

const fieldStyle = (active: boolean): React.CSSProperties => ({
  height: 56,
  backgroundColor: '#FFFFFF',
  border: active ? '1.5px solid #B5935A' : '1.5px solid rgba(0,0,0,0.10)',
  boxShadow: active ? '0 0 0 3px rgba(181,147,90,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
  color: '#1A1A1A',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border 150ms, box-shadow 150ms',
  caretColor: '#B5935A',
  borderRadius: 14,
  width: '100%',
  padding: '0 16px',
});

/**
 * Screen C — name collection.
 * Collects first + last name, saves to profile, then advances to team intro.
 * autocomplete attributes enable iOS Safari contact autofill (one-tap populate).
 */
const InviteNamePage = () => {
  const navigate = useNavigate();
  const ctx = loadInviteContext();
  const lastRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'first' | 'last' | null>(null);

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveName(firstName.trim(), lastName.trim());
      saveInviteContext({ firstName: firstName.trim(), lastName: lastName.trim() });
      navigate('/invite/team');
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
        style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
      >
        What's your name?
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: '#666' }}>
        Your collaborators will see this in the song.
      </p>

      {/* First name */}
      <div className="mb-4">
        <label
          htmlFor="first-name"
          className="block text-[0.875rem] font-medium mb-2"
          style={{ color: '#666' }}
        >
          First name
        </label>
        <input
          id="first-name"
          type="text"
          autoComplete="given-name"
          autoFocus
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onFocus={() => setFocusedField('first')}
          onBlur={() => setFocusedField(null)}
          onKeyDown={(e) => { if (e.key === 'Enter') lastRef.current?.focus(); }}
          placeholder="First"
          aria-required="true"
          style={fieldStyle(focusedField === 'first' || !!firstName)}
        />
      </div>

      {/* Last name */}
      <div className="mb-8">
        <label
          htmlFor="last-name"
          className="block text-[0.875rem] font-medium mb-2"
          style={{ color: '#666' }}
        >
          Last name
        </label>
        <input
          id="last-name"
          ref={lastRef}
          type="text"
          autoComplete="family-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onFocus={() => setFocusedField('last')}
          onBlur={() => setFocusedField(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) handleContinue(); }}
          placeholder="Last"
          aria-required="true"
          style={fieldStyle(focusedField === 'last' || !!lastName)}
        />
      </div>

      {error && (
        <p className="text-sm text-center mb-4" style={{ color: '#E05440' }} role="alert">
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
