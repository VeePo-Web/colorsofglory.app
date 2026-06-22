import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { loadInviteContext, saveInviteContext, getAvatarColor } from "@/lib/invite/inviteContext";
import { acceptInvite } from "@/lib/invite/inviteApi";
import { getSessionUser, sendPhoneOtp, AuthError } from "@/integrations/cog/auth";

/** Last 10 digits — lets us compare an e164 against a session's stored phone. */
function last10(s: string): string {
  return s.replace(/\D/g, "").slice(-10);
}

function nationalDisplay(e164: string): string {
  const d = last10(e164);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
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
        return "We couldn't reach the network. Check your connection and try again.";
      default:
        return err.message || "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

/**
 * Screen A2 — existing user detected.
 * Shows "Welcome back, [First Name]" and a single "Join [Song Title]" CTA.
 *
 * An existing account is detected by phone-registration lookup, which does NOT
 * create a session. So a true one-tap join only works when a *matching* session
 * already exists on THIS device. Otherwise we must send a real (guarded) OTP and
 * route to verify — never assume "you're already in", which previously dead-ended
 * the user on a verify screen showing a code that was never sent.
 */
const InviteWelcomeBackPage = () => {
  const navigate = useNavigate();
  const ctx = loadInviteContext();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = ctx?.existingFirstName ?? 'you';
  const songTitle = ctx?.songTitle ?? 'the song';
  const avatarInitials = firstName.slice(0, 2).toUpperCase();
  const avatarColor = getAvatarColor(ctx?.verifiedPhone ?? 'user');

  const handleJoin = async () => {
    if (!ctx?.token) { navigate('/join', { replace: true }); return; }
    setIsJoining(true);
    setError(null);
    try {
      const phone = ctx.verifiedPhone;
      const user = await getSessionUser();

      // True one-tap: a live session already exists on this device AND it
      // belongs to the phone we're joining with — accept straight away.
      if (user && phone && last10(user.phone ?? '') === last10(phone)) {
        await acceptInvite(ctx.token);
        saveInviteContext({ isExistingUser: true });
        navigate('/invite/team');
        return;
      }

      // Existing account but no matching session here (e.g. a new device).
      // Send a real, toll-fraud-guarded code and route to verify with the
      // phone stored, so verify never shows a "code sent" it never sent.
      if (!phone) { navigate(`/join/${ctx.token}`, { replace: true }); return; }
      await sendPhoneOtp(phone);
      sessionStorage.setItem('cog:phone-e164', phone);
      sessionStorage.setItem('cog:phone-display', nationalDisplay(phone));
      navigate('/invite/verify');
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: '#FAFAF6' }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.10) 0%, transparent 65%)' }}
      />
      <div
        className="relative flex flex-col flex-1 px-6 pt-16 pb-10 mx-auto w-full"
        style={{ maxWidth: 430 }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Song title + inviter */}
        <h1
          className="text-[1.75rem] font-bold text-center mb-2 leading-snug"
          style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
        >
          {songTitle}
        </h1>
        <p className="text-[1rem] text-center mb-10" style={{ color: '#666' }}>
          {ctx?.inviterFirstName} invited you to join
        </p>

        {/* Welcome back card */}
        <div
          className="rounded-2xl p-5 mb-8 flex items-center gap-4"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid rgba(181,147,90,0.30)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          {/* Avatar */}
          <div
            className="flex items-center justify-center rounded-full text-white font-bold text-lg flex-shrink-0"
            style={{ width: 52, height: 52, backgroundColor: avatarColor }}
            aria-hidden="true"
          >
            {avatarInitials}
          </div>
          <div>
            <p
              className="text-[1.125rem] font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
            >
              Welcome back, {firstName}.
            </p>
            <p className="text-[0.875rem]" style={{ color: '#666' }}>
              Tap to join the song.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-center mb-4" style={{ color: '#E05440' }} role="alert">
            {error}
          </p>
        )}

        {/* CTA */}
        <GoldButton
          loading={isJoining}
          loadingText="Joining..."
          onClick={handleJoin}
        >
          Join {songTitle} →
        </GoldButton>

        {/* Trust line */}
        <p className="text-[0.75rem] text-center mt-3" style={{ color: '#999' }}>
          Tap to continue into your song.
        </p>
      </div>
    </div>
  );
};

export default InviteWelcomeBackPage;
