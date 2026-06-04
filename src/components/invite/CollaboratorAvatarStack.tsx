import { useEffect, useRef } from "react";

interface Collaborator {
  userId: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  avatarInitials: string;
}

interface CollaboratorAvatarStackProps {
  collaborators: Collaborator[];
  size?: number;        // circle diameter in px
  maxVisible?: number;  // clips beyond this, shows "+N" remainder
  stagger?: boolean;    // entrance animation
  className?: string;
}

/**
 * Stacked circular avatar row used on Screen D (team intro) and catalog cards.
 * Consistent color per user from the aurora palette.
 * Stagger animation slides each circle in from the left with 100ms delay.
 */
const CollaboratorAvatarStack = ({
  collaborators,
  size = 48,
  maxVisible = 3,
  stagger = false,
  className = '',
}: CollaboratorAvatarStackProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger stagger animation after mount
  useEffect(() => {
    if (!stagger || !containerRef.current) return;
    const circles = containerRef.current.querySelectorAll<HTMLElement>('[data-avatar]');
    circles.forEach((el, i) => {
      el.style.animation = `none`;
      el.style.opacity = '0';
      el.style.transform = 'translateX(-16px)';
      // RAF to let the initial state render first
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.style.transition = `opacity 300ms cubic-bezier(0.22,1,0.36,1), transform 300ms cubic-bezier(0.22,1,0.36,1)`;
          el.style.opacity = '1';
          el.style.transform = 'translateX(0)';
        }, i * 100);
      });
    });
  }, [stagger]);

  const visible = collaborators.slice(0, maxVisible);
  const remainder = collaborators.length - maxVisible;
  const fontSize = Math.round(size * 0.3);
  const border = size > 36 ? 2.5 : 2;
  const overlap = Math.round(size * 0.28);

  return (
    <div
      ref={containerRef}
      className={`flex items-center ${className}`}
      style={{ gap: 0 }}
      aria-label={`${collaborators.length} collaborator${collaborators.length !== 1 ? 's' : ''}`}
    >
      {visible.map((c, i) => (
        <div
          key={c.userId}
          data-avatar
          className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
          style={{
            width: size,
            height: size,
            backgroundColor: c.avatarColor,
            border: `${border}px solid #FAFAF6`,
            fontSize,
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: visible.length - i + 1,
            position: 'relative',
          }}
          title={`${c.firstName} ${c.lastName}`}
          aria-label={`${c.firstName} ${c.lastName}`}
        >
          {c.avatarInitials}
        </div>
      ))}

      {remainder > 0 && (
        <div
          className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
          style={{
            width: size,
            height: size,
            backgroundColor: 'rgba(0,0,0,0.07)',
            border: `${border}px solid #FAFAF6`,
            fontSize: Math.round(fontSize * 0.85),
            color: '#666',
            marginLeft: -overlap,
            position: 'relative',
            zIndex: 1,
          }}
          aria-label={`and ${remainder} more`}
        >
          +{remainder}
        </div>
      )}
    </div>
  );
};

export default CollaboratorAvatarStack;
