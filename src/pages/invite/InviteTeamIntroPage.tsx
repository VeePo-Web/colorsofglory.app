import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import {
  loadInviteContext,
  formatCollaboratorNames,
  clearInviteContext,
} from "@/lib/invite/inviteContext";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

const AUTO_ADVANCE_MS = 2200;

const ROLE_LABELS = {
  owner: 'Owner',
  viewer: 'Viewer',
  contributor: 'Contributor',
  reviewer: 'Reviewer',
} as const;

/**
 * Screen D — team intro.
 * Shows who's already in the song with staggered avatar animation.
 * Auto-advances to lyrics after 2.2 seconds. Progress bar communicates timing.
 * On tap: cancels timer and navigates immediately.
 */
const InviteTeamIntroPage = () => {
  const navigate = useNavigate();
  // This screen auto-advances into the song in ~2.2s — fetch the song canvas
  // now so the invitee's first landing in the song renders instantly.
  useIdlePrefetch(() => import("@/pages/SongCanvasPage"));
  const ctx = loadInviteContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const songId = ctx?.songId ?? '1';
  const songTitle = ctx?.songTitle ?? 'the song';
  const collaborators = ctx?.collaborators ?? [];
  const assignedRole = ctx?.assignedRole ?? 'contributor';
  const firstName = ctx?.firstName ?? ctx?.existingFirstName ?? '';

  // Filter out the current user from the displayed collaborators
  const displayedCollabs = collaborators.slice(0, 5);
  const collabFirstNames = displayedCollabs.map((c) => c.firstName);
  const collabSentence = formatCollaboratorNames(collabFirstNames);

  // Reduced-motion users (and assistive tech) shouldn't be whisked off this
  // screen on a 2.2s timer before they've read who's here — let them tap.
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const goToSong = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearInviteContext();
    navigate(`/songs/${songId}/lyrics?invite=1&role=${assignedRole}`, { replace: true });
  };

  useEffect(() => {
    // Honor reduced motion: no bar animation, no auto-advance — the user taps in.
    if (reduceMotion) return;

    // Start progress bar animation
    if (barRef.current) {
      barRef.current.style.width = '0%';
      requestAnimationFrame(() => {
        if (barRef.current) {
          barRef.current.style.transition = `width ${AUTO_ADVANCE_MS}ms linear`;
          barRef.current.style.width = '100%';
        }
      });
    }

    // Auto-advance
    timerRef.current = setTimeout(goToSong, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: '#FAFAF6' }}
    >
      {/* Auto-advance progress bar — thin gold line at very top. Hidden when the
          user prefers reduced motion (auto-advance is disabled in that case). */}
      {!reduceMotion && (
        <div
          className="fixed top-0 left-0 right-0"
          style={{ height: 2, backgroundColor: 'rgba(181,147,90,0.15)', zIndex: 999 }}
        >
          <div
            ref={barRef}
            style={{ height: '100%', backgroundColor: '#B5935A', width: '0%', borderRadius: 9999 }}
          />
        </div>
      )}

      {/* Subtle glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.10) 0%, transparent 65%)' }}
      />

      <div
        className="relative flex flex-col flex-1 items-center justify-center px-6 py-16 mx-auto w-full"
        style={{ maxWidth: 430 }}
      >
        {/* Logo */}
        <div className="mb-10">
          <CogBrand variant="stacked" size="sm" />
        </div>

        {/* Avatar stack — staggered entrance from left */}
        {displayedCollabs.length > 0 && (
          <div className="mb-6">
            <CollaboratorAvatarStack
              collaborators={displayedCollabs}
              size={52}
              maxVisible={4}
              stagger={true}
            />
          </div>
        )}

        {/* Who's here */}
        {collabSentence ? (
          <p
            className="text-[1.125rem] font-semibold text-center mb-1 leading-snug"
            style={{ color: '#1A1A1A', fontFamily: 'var(--font-body)' }}
          >
            {collabSentence}
          </p>
        ) : null}
        <p
          className="text-[1rem] text-center mb-8"
          style={{ color: '#666' }}
        >
          {collabSentence
            ? (collaborators.length === 1 ? 'is already working on this song.' : 'are already working on this song.')
            : 'Be the first to collaborate on this song.'}
        </p>

        {/* Song card */}
        <div
          className="w-full rounded-2xl p-5 mb-10"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid rgba(181,147,90,0.30)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <p
            className="text-[1.375rem] font-bold mb-2 leading-snug"
            style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
          >
            {songTitle}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.75rem] font-semibold"
              style={{
                backgroundColor: 'rgba(181,147,90,0.12)',
                color: '#B5935A',
                border: '1px solid rgba(181,147,90,0.25)',
              }}
            >
              {ROLE_LABELS[assignedRole]}
            </span>
            {firstName && (
              <p className="text-[0.875rem]" style={{ color: '#666' }}>
                Welcome, {firstName}.
              </p>
            )}
          </div>
        </div>

        {/* CTA */}
        <GoldButton onClick={goToSong} className="w-full">
          Enter the song →
        </GoldButton>

        <p className="text-[0.75rem] text-center mt-3" style={{ color: '#999' }}>
          {reduceMotion ? 'Tap to enter your song.' : 'Auto-entering in a moment...'}
        </p>
      </div>
    </div>
  );
};

export default InviteTeamIntroPage;
