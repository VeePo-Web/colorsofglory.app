import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Mic, MessageSquare } from "lucide-react";

const LS_KEY = 'cog:invite-first-action-shown';

interface FirstActionSheetProps {
  /** ms after mount before appearing (default 1500) */
  delay?: number;
  onDismiss?: () => void;
}

interface Chip {
  icon: React.ElementType;
  label: string;
  route: string;
  color: string;
}

const CHIPS: Chip[] = [
  { icon: FileText,      label: '+ Write a lyric',    route: 'lyrics',    color: '#1A1A1A' },
  { icon: Mic,           label: '🎤 Voice memo',       route: 'voice',     color: '#1A1A1A' },
  { icon: MessageSquare, label: '💬 Leave a comment',  route: 'activity',  color: '#1A1A1A' },
];

/**
 * Bottom sheet that slides up once after the new collaborator lands in Lyrics.
 * Shown once per browser session (localStorage flag).
 * Dismisses on: backdrop tap, chip tap, swipe down gesture.
 */
const FirstActionSheet = ({ delay = 1500, onDismiss }: FirstActionSheetProps) => {
  const { id: songId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only show once per session
    if (localStorage.getItem(LS_KEY)) return;
    const t1 = setTimeout(() => setMounted(true), delay);
    const t2 = setTimeout(() => setVisible(true), delay + 50);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delay]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(LS_KEY, '1');
    setTimeout(() => { setMounted(false); onDismiss?.(); }, 350);
  };

  // Esc closes the modal — expected dialog behavior (HIG / WCAG) that was missing.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleChip = (route: string) => {
    dismiss();
    navigate(`/songs/${songId ?? '1'}/${route}`);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,0.20)',
          zIndex: 600,
          transition: 'opacity 300ms ease',
          opacity: visible ? 1 : 0,
        }}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[601] rounded-t-3xl px-5 pb-10 pt-4"
        style={{
          backgroundColor: '#FAFAF6',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.16)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1)',
          maxWidth: 430,
          margin: '0 auto',
        }}
        role="dialog"
        aria-label="First action in this song"
        aria-modal="true"
      >
        {/* Handle bar */}
        <div
          className="mx-auto mb-5 rounded-full"
          style={{ width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.12)' }}
        />

        {/* Heading */}
        <p
          className="text-[1rem] font-semibold text-center mb-5"
          style={{ color: '#1A1A1A', fontFamily: 'var(--font-body)' }}
        >
          You're inside the song. Start by:
        </p>

        {/* Action chips */}
        <div className="flex flex-col gap-3 mb-5">
          {CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.route}
                onClick={() => handleChip(chip.route)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-150 active:scale-[0.98] text-left"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 36, height: 36, backgroundColor: 'rgba(184,149,58,0.10)' }}
                >
                  <Icon size={17} strokeWidth={1.6} style={{ color: 'var(--cog-gold)' }} />
                </div>
                <span className="text-[0.9375rem] font-medium" style={{ color: '#1A1A1A', fontFamily: 'var(--font-body)' }}>
                  {chip.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={dismiss}
          className="text-[0.8125rem] text-center w-full py-2 transition-opacity hover:opacity-70"
          style={{ color: '#999', fontFamily: 'var(--font-body)' }}
        >
          Tap outside to dismiss
        </button>
      </div>
    </>
  );
};

export default FirstActionSheet;
