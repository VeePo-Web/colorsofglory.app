import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp, verifyPhoneOtp } from "@/integrations/cog/auth";
import { useWebOtpAutofill } from "@/lib/auth/useWebOtpAutofill";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OTPInput from "@/components/cog/OTPInput";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { loadInviteContext, saveInviteContext } from "@/lib/invite/inviteContext";
import { acceptInvite } from "@/lib/invite/inviteApi";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

function toFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Invalid') || msg.includes('expired'))
    return "That code didn't work. Check it and try again.";
  if (msg.includes('rate')) return "Too many attempts. Please wait a moment.";
  return "Something went wrong. Please try again.";
}

/**
 * Screen B — invite OTP verification.
 * Thin wrapper: same 6-box OTP UI, but on success accepts the invite
 * and routes to /invite/name (not /onboarding/intent).
 *
 * Parity with the main CodeVerify screen: WebOTP zero-tap auto-read (Android
 * Chrome) + a calm "new code sent" resend confirmation, so the invite path is
 * just as frictionless as the direct sign-in path.
 */
const InviteVerifyPage = () => {
  const navigate = useNavigate();
  const ctx = loadInviteContext();
  // While the code arrives, fetch the name step so verify → name is instant.
  useIdlePrefetch(() => import("@/pages/invite/InviteNamePage"));

  const e164 = sessionStorage.getItem('cog:phone-e164') ?? '';
  const displayPhone = sessionStorage.getItem('cog:phone-display') ?? 'your number';
  const songTitle = ctx?.songTitle ?? 'the song';
  const backToJoin = ctx?.token ? `/join/${ctx.token}` : '/join';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (!e164) navigate(backToJoin, { replace: true });
  }, [e164, navigate, backToJoin]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleVerify = useCallback(async (code: string) => {
    if (code.length < CODE_LENGTH || isVerifying || !ctx?.token) return;
    setIsVerifying(true);
    setError(null);
    try {
      await verifyPhoneOtp(e164, code);

      // Accept invite immediately after auth
      await acceptInvite(ctx.token);
      saveInviteContext({ isExistingUser: false });
      // Subtle "you're in" beat — flash the cells gold, then continue. Reduced-
      // motion users skip the pause; the form stays locked through it.
      setSuccess(true);
      const reduce = typeof window !== 'undefined' && !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await new Promise((r) => setTimeout(r, reduce ? 0 : 500));
      navigate('/invite/name');
    } catch (err) {
      setError(toFriendlyError(err));
      setDigits(Array(CODE_LENGTH).fill(''));
      setIsVerifying(false);
    }
  }, [e164, isVerifying, ctx, navigate]);

  // Lowest-friction path: auto-read the SMS code (Android Chrome), fill, submit.
  // Progressive — no-ops where unsupported; manual entry always still works.
  const handleAutoCode = useCallback((code: string) => {
    const next = code.slice(0, CODE_LENGTH).split('');
    setDigits([...next, ...Array(Math.max(0, CODE_LENGTH - next.length)).fill('')]);
    if (next.length >= CODE_LENGTH) void handleVerify(code.slice(0, CODE_LENGTH));
  }, [handleVerify]);

  useWebOtpAutofill(!isVerifying, handleAutoCode);

  const handleResend = async () => {
    if (isResending || countdown > 0) return;
    setIsResending(true);
    setError(null);
    setResent(false);
    setDigits(Array(CODE_LENGTH).fill(''));
    setCountdown(RESEND_SECONDS);
    try {
      await sendPhoneOtp(e164);
      setResent(true);
    } catch {
      setError("Couldn't resend. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <OnboardingShell>
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Invite-specific headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
      >
        One step from{'\n'}the song
      </h1>
      <p className="text-[1rem] text-center mb-2" style={{ color: '#666' }}>
        We sent a 6-digit code to{' '}
        <span style={{ color: '#1A1A1A', fontWeight: 500 }}>+1 {displayPhone}</span>
      </p>
      <p className="text-[0.875rem] text-center mb-8" style={{ color: '#B5935A' }}>
        to join {songTitle}
      </p>

      {/* OTP boxes */}
      <div className="mb-3">
        <OTPInput
          length={CODE_LENGTH}
          value={digits}
          onChange={setDigits}
          onComplete={handleVerify}
          disabled={isVerifying}
          error={!!error}
          success={success}
        />
      </div>

      <p
        className="text-[0.8125rem] text-center mb-6 transition-colors"
        style={{ color: resent ? '#7A8B5A' : '#999' }}
        aria-live="polite"
      >
        {resent ? 'New code sent — check your messages.' : 'Codes usually arrive within a few seconds.'}
      </p>

      {error && (
        <p className="text-sm text-center mb-5" style={{ color: '#E05440' }} role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <GoldButton
        disabled={digits.some((d) => !d)}
        loading={isVerifying}
        loadingText="Verifying..."
        onClick={() => handleVerify(digits.join(''))}
      >
        Verify
      </GoldButton>

      <div className="flex justify-between mt-5 text-sm">
        <button
          onClick={handleResend}
          disabled={countdown > 0 || isResending}
          className="transition-opacity hover:opacity-70 disabled:opacity-40 underline"
          style={{ color: '#B5935A', fontFamily: 'var(--font-body)' }}
        >
          {countdown > 0 ? `Resend code (${countdown}s)` : 'Resend code'}
        </button>
        <button
          onClick={() => navigate(backToJoin)}
          className="transition-opacity hover:opacity-70"
          style={{ color: '#999', fontFamily: 'var(--font-body)' }}
        >
          Change number
        </button>
      </div>
    </OnboardingShell>
  );
};

export default InviteVerifyPage;
