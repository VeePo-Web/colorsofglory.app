import { useEffect, useState } from "react";
import type { InviteRole } from "@/lib/invite/inviteContext";

const ROLE_COPY: Record<InviteRole, string> = {
  viewer: "You can listen and read.",
  contributor: "You can write lyrics, add voice memos, and comment.",
  reviewer: "You can comment and approve changes.",
  collaborator: "You can write lyrics, add voice memos, and comment.",
};

const ROLE_LABEL: Record<InviteRole, string> = {
  viewer: "Viewer",
  contributor: "Contributor",
  reviewer: "Reviewer",
  collaborator: "Contributor",
};

interface RoleToastProps {
  role: InviteRole;
  /** ms after mount before showing (default 500) */
  delay?: number;
  /** how long it stays visible in ms (default 3200) */
  duration?: number;
}

/**
 * "You joined as Contributor" toast — shown once after arriving in lyrics via invite.
 * Slides up from bottom, auto-dismisses. Shown once per session.
 */
const RoleToast = ({ role, delay = 500, duration = 3200 }: RoleToastProps) => {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('entering'), delay);
    const t2 = setTimeout(() => setPhase('visible'), delay + 200);
    const t3 = setTimeout(() => setPhase('leaving'), delay + duration);
    const t4 = setTimeout(() => setPhase('hidden'), delay + duration + 250);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [delay, duration]);

  if (phase === 'hidden') return null;

  return (
    <div
      className="fixed left-0 right-0 px-5 z-50"
      style={{
        bottom: 96, // above SongTabBar
        transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease',
        transform: phase === 'entering' || phase === 'leaving' ? 'translateY(20px)' : 'translateY(0)',
        opacity: phase === 'visible' ? 1 : 0,
        pointerEvents: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="mx-auto flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          maxWidth: 430,
          backgroundColor: 'rgba(250,250,246,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(184,149,58,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Role chip */}
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.75rem] font-semibold flex-shrink-0"
          style={{ backgroundColor: 'rgba(184,149,58,0.12)', color: 'var(--cog-gold)', border: '1px solid rgba(184,149,58,0.25)' }}
        >
          {ROLE_LABEL[role]}
        </span>
        {/* Description */}
        <p className="text-[0.875rem]" style={{ color: '#666', fontFamily: 'var(--font-body)' }}>
          {ROLE_COPY[role]}
        </p>
      </div>
    </div>
  );
};

export default RoleToast;
