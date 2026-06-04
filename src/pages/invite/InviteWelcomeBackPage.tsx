import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { loadInviteContext, saveInviteContext, getAvatarColor } from "@/lib/invite/inviteContext";
import { acceptInvite } from "@/lib/invite/inviteApi";

/**
 * Screen A2 — existing user detected.
 * Shows "Welcome back, [First Name]" and a single "Join [Song Title]" CTA.
 * No OTP needed — the session already exists.
 * Target: tap → inside the song in under 3 seconds.
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
    if (!ctx?.token) { navigate('/invite/verify'); return; }
    setIsJoining(true);
    setError(null);
    try {
      const result = await acceptInvite(ctx.token);
      saveInviteContext({ userId: null, isExistingUser: true });
      navigate('/invite/team');
      void result;
    } catch {
      // If silent auth fails, fall back to OTP
      navigate('/invite/verify');
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
          No code needed — you're already in.
        </p>
      </div>
    </div>
  );
};

export default InviteWelcomeBackPage;
