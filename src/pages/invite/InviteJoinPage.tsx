import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sendPhoneOtp, AuthError, useCurrentAccount } from "@/integrations/cog/auth";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import BlurredLyricsPreview from "@/components/invite/BlurredLyricsPreview";
import InviteErrorCard from "@/components/invite/InviteErrorCard";
import { previewInvite, checkPhoneRegistered, acceptInvite, type InvitePreview } from "@/lib/invite/inviteApi";
import { saveInviteContext } from "@/lib/invite/inviteContext";
import { InviteError, parseSupabaseError, type InviteErrorCode } from "@/lib/invite/inviteErrors";
import { requestNewInvite } from "@/integrations/cog/songs";

// ─── Phone formatting ─────────────────────────────────────────────────────────

const DIGITS_MAX = 10;

function formatDisplay(d: string): string {
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function toE164(digits: string): string {
  return `+1${digits}`;
}

function toFriendlyError(err: unknown): string {
  if (err instanceof AuthError) {
    switch (err.code) {
      case "GEO_BLOCKED":
        return "SMS sign-in isn't available in your region yet.";
      case "RATE_LIMITED":
        return "Too many attempts. Please wait a minute and try again.";
      case "PHONE_PROVIDER_DISABLED":
        return "SMS sign-in isn't available right now. Please try again shortly.";
      case "NETWORK":
        return "We couldn't send the code. Check your connection and try again.";
      default:
        return err.message || "We couldn't send the code. Please try again.";
    }
  }
  return "We couldn't send the code. Please try again.";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const InviteSkeleton = () => (
  <div className="animate-pulse space-y-4 w-full">
    <div className="h-6 w-40 rounded-full mx-auto" style={{ backgroundColor: 'rgba(181,147,90,0.12)' }} />
    <div className="h-4 w-56 rounded-full mx-auto" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
    <div
      className="w-full rounded-2xl"
      style={{ height: 120, backgroundColor: 'rgba(0,0,0,0.04)' }}
    />
    <div className="h-16 w-full rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
    <div className="h-14 w-full rounded-full" style={{ backgroundColor: 'rgba(181,147,90,0.12)' }} />
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState =
  | { type: 'loading' }
  | { type: 'error'; code: InviteErrorCode }
  | { type: 'input'; preview: InvitePreview }
  | { type: 'submitting'; preview: InvitePreview };

const InviteJoinPage = () => {
  const { token = 'demo' } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Already-signed-in fast path (Church Center one-tap): if a session exists we
  // skip phone entry entirely and let them accept in a single tap.
  const { loading: accountLoading, user: accountUser, profile: accountProfile } = useCurrentAccount();
  const [useDifferentNumber, setUseDifferentNumber] = useState(false);
  const [joining, setJoining] = useState(false);
  const signedInFirstName = accountProfile?.display_name?.trim().split(/\s+/)[0] || "you";

  const isValid = digits.length === DIGITS_MAX;

  // Load invite on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preview = await previewInvite(token);
        if (cancelled) return;
        saveInviteContext({
          token,
          songId: preview.songId,
          songTitle: preview.songTitle,
          inviterFirstName: preview.inviterFirstName,
          inviterLastName: preview.inviterLastName,
          inviterAvatarColor: preview.inviterAvatarColor,
          assignedRole: preview.assignedRole,
          lyricsSnippet: preview.lyricsSnippet,
          collaborators: preview.collaborators,
          collaboratorCount: preview.collaboratorCount,
          maxUses: preview.maxUses,
          currentUses: preview.currentUses,
        });
        setState({ type: 'input', preview });
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof InviteError
          ? err.code
          : parseSupabaseError(err);
        setState({ type: 'error', code });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Debounced existing-user check
  useEffect(() => {
    if (!isValid) { setExistingName(null); return; }
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      const result = await checkPhoneRegistered(toE164(digits));
      if (result.exists) setExistingName(result.firstName);
      else setExistingName(null);
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [digits, isValid]);

  const handleContinue = async () => {
    if (state.type !== 'input' || !isValid) return;

    const e164 = toE164(digits);
    saveInviteContext({ verifiedPhone: e164, isExistingUser: !!existingName, existingFirstName: existingName });

    // Existing user — skip OTP, go to welcome-back screen
    if (existingName) {
      navigate('/invite/welcome');
      return;
    }

    const preview = state.preview;
    setState({ type: 'submitting', preview });
    setPhoneError(null);

    try {
      // Route through the auth SDK so the invite OTP path gets the same
      // toll-fraud / SMS-pumping rails (geo allowlist + per-phone/IP velocity
      // caps + global daily ceiling) as the main phone login — never a raw,
      // unguarded send. The resend on /invite/verify already uses sendPhoneOtp.
      await sendPhoneOtp(e164);
      sessionStorage.setItem('cog:phone-e164', e164);
      sessionStorage.setItem('cog:phone-display', formatDisplay(digits));
      navigate('/invite/verify');
    } catch (err) {
      setPhoneError(toFriendlyError(err));
      setState((prev) =>
        prev.type === 'submitting' || prev.type === 'input'
          ? { type: 'input', preview: prev.preview }
          : prev
      );
    }
  };

  // Already signed in → one-tap accept, no phone re-entry.
  const handleOneTapJoin = async () => {
    if (state.type !== 'input' || joining) return;
    setJoining(true);
    setPhoneError(null);
    try {
      await acceptInvite(token);
      saveInviteContext({ isExistingUser: true, existingFirstName: signedInFirstName });
      navigate('/invite/team');
    } catch {
      // One-tap accept failed — fall back to the phone path.
      setJoining(false);
      setUseDifferentNumber(true);
    }
  };

  const handleRequestNew = async () => {
    // Actually record the request (invite_requests) so the owner can re-send —
    // previously this faked "Request sent" and did nothing. Best-effort: the
    // owner notification is non-critical, so we acknowledge regardless.
    try {
      await requestNewInvite({
        original_token: token,
        phone: digits.length === DIGITS_MAX ? toE164(digits) : null,
      });
    } catch {
      /* swallow — acknowledged below either way */
    }
    setRequestSent(true);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state.type === 'loading' || accountLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAFAF6' }}>
        <div className="flex flex-col flex-1 px-6 pt-20 mx-auto w-full" style={{ maxWidth: 430 }}>
          <div className="flex justify-center mb-10">
            <CogBrand variant="stacked" size="md" />
          </div>
          <InviteSkeleton />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state.type === 'error') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAFAF6' }}>
        <div className="flex flex-col flex-1 px-6 pt-20 mx-auto w-full" style={{ maxWidth: 430 }}>
          <div className="flex justify-center mb-10">
            <CogBrand variant="stacked" size="md" />
          </div>
          {requestSent ? (
            <div className="text-center">
              <div
                className="mx-auto mb-5 flex items-center justify-center rounded-full"
                style={{ width: 56, height: 56, backgroundColor: 'rgba(181,147,90,0.12)', border: '1.5px solid rgba(181,147,90,0.30)' }}
              >
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-[1.375rem] font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}>
                Request sent!
              </p>
              <p className="text-[0.9375rem]" style={{ color: '#666' }}>
                The song owner has been notified.
              </p>
            </div>
          ) : (
            <InviteErrorCard
              code={state.code}
              onRequestNew={handleRequestNew}
              onOpenSong={() => navigate('/songs/1/lyrics')}
              onGoHome={() => navigate('/')}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Input / Submitting ───────────────────────────────────────────────────────
  const preview = state.preview;
  const isSubmitting = state.type === 'submitting';
  const ctaCopy = existingName ? `Continue as ${existingName} →` : 'Join this song →';

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: '#FAFAF6' }}
    >
      {/* Subtle right-corner amber glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 90% 90%, rgba(181,147,90,0.10) 0%, transparent 65%)' }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pt-16 pb-10 mx-auto w-full"
        style={{ maxWidth: 430 }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Song context card */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid rgba(181,147,90,0.30)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          {/* Song title + inviter */}
          <p
            className="text-[1.3125rem] font-bold mb-1 leading-snug"
            style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
          >
            {preview.songTitle}
          </p>
          <p className="text-[0.875rem] mb-4" style={{ color: '#666' }}>
            {preview.inviterFirstName} invited you to collaborate
          </p>

          {/* Blurred lyrics preview */}
          {preview.lyricsSnippet && (
            <div className="mb-2">
              <BlurredLyricsPreview snippet={preview.lyricsSnippet} maxLines={3} />
              <p className="text-[0.75rem] mt-1.5 italic" style={{ color: '#999' }}>
                Join to read and contribute ↗
              </p>
            </div>
          )}
        </div>

        {/* Already signed in → one tap to join, no phone needed (Church Center). */}
        {accountUser && !useDifferentNumber ? (
          <>
            <GoldButton loading={joining} loadingText="Joining..." onClick={handleOneTapJoin}>
              Join as {signedInFirstName} →
            </GoldButton>
            <button
              onClick={() => setUseDifferentNumber(true)}
              className="text-[0.8125rem] text-center w-full py-4 transition-opacity hover:opacity-70 underline"
              style={{ color: '#999', fontFamily: 'var(--font-body)' }}
            >
              Use a different number
            </button>
            <p className="text-[0.75rem] text-center" style={{ color: '#999' }}>
              Invited songs don't use your free song.
            </p>
          </>
        ) : (
        <>
        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }} />
          <span className="text-[0.8125rem]" style={{ color: '#999', whiteSpace: 'nowrap' }}>
            Enter your number to join
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }} />
        </div>

        {/* Phone input */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 mb-2 transition-all duration-150"
          style={{
            height: 64,
            backgroundColor: '#FFFFFF',
            border: phoneError
              ? '1.5px solid #E05440'
              : isValid
              ? '1.5px solid #B5935A'
              : '1.5px solid rgba(0,0,0,0.12)',
            boxShadow: isValid && !phoneError ? '0 0 0 3px rgba(181,147,90,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <span className="text-xl leading-none" aria-hidden="true">🇺🇸</span>
          <span className="text-base font-medium flex-shrink-0" style={{ color: '#666' }}>+1</span>
          <div className="self-stretch my-3" style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.10)' }} />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={formatDisplay(digits)}
            onChange={(e) => {
              setDigits(e.target.value.replace(/\D/g, '').slice(0, DIGITS_MAX));
              setPhoneError(null);
            }}
            placeholder="(555) 555-5555"
            aria-label="Phone number"
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: '#1A1A1A', fontFamily: 'var(--font-body)', caretColor: '#B5935A' }}
          />
        </div>

        {/* Phone error */}
        {phoneError && (
          <p className="text-[0.8125rem] mb-2" style={{ color: '#E05440' }} role="alert" aria-live="polite">
            {phoneError}
          </p>
        )}

        {/* Microcopy */}
        <p className="text-[0.8125rem] text-center mb-5" style={{ color: '#999' }}>
          We'll send a code. No password needed.
        </p>

        {/* CTA */}
        <GoldButton
          disabled={!isValid}
          loading={isSubmitting}
          loadingText="Sending code..."
          onClick={handleContinue}
        >
          {ctaCopy}
        </GoldButton>

        {/* Trust line */}
        <p className="text-[0.75rem] text-center mt-3" style={{ color: '#999' }}>
          Invited songs don't use your free song.
        </p>
        </>
        )}

        {/* T&C */}
        <p className="text-[0.6875rem] text-center mt-auto pt-8" style={{ color: '#CCC' }}>
          By continuing you agree to our{' '}
          <span className="underline cursor-pointer">Terms</span> &{' '}
          <span className="underline cursor-pointer">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
};

export default InviteJoinPage;
