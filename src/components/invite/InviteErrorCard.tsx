import { AlertCircle, CheckCircle } from "lucide-react";
import GoldButton from "@/components/cog/GoldButton";
import { INVITE_ERROR_META, type InviteErrorCode } from "@/lib/invite/inviteErrors";

interface InviteErrorCardProps {
  code: InviteErrorCode;
  inviterFirstName?: string;
  joinedAt?: string;       // ISO date string for "already member" copy
  songId?: string;         // for "open song" navigation
  onRetry?: () => void;
  onRequestNew?: () => void;
  onOpenSong?: () => void;
  onGoHome?: () => void;
  isLoading?: boolean;
}

/**
 * Handles all invite error states: expired, revoked, capacity, already joined.
 * Used inline on Screen A when the token lookup fails.
 */
const InviteErrorCard = ({
  code,
  inviterFirstName,
  joinedAt,
  onRetry,
  onRequestNew,
  onOpenSong,
  onGoHome,
  isLoading = false,
}: InviteErrorCardProps) => {
  const meta = INVITE_ERROR_META[code];
  const isAlreadyMember = code === 'INVITE_ALREADY_MEMBER';

  const handleCta = () => {
    if (meta.ctaAction === 'request_new') onRequestNew?.();
    if (meta.ctaAction === 'open_song')   onOpenSong?.();
    if (meta.ctaAction === 'go_home')     onGoHome?.();
    if (meta.ctaAction === 'retry')       onRetry?.();
  };

  // Personalize inviter references
  const owner = inviterFirstName ?? 'the owner';
  const headline = meta.showInviterName
    ? meta.headline.replace('the owner', owner)
    : meta.headline;
  const ctaLabel = meta.showInviterName
    ? meta.ctaLabel.replace('the owner', owner)
    : meta.ctaLabel;

  // Format join date for "already member"
  const joinedDateStr = joinedAt
    ? new Date(joinedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  return (
    <div
      className="w-full rounded-2xl p-6 flex flex-col items-center text-center"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full mb-5"
        style={{
          width: 56,
          height: 56,
          backgroundColor: isAlreadyMember
            ? 'rgba(181,147,90,0.12)'
            : 'rgba(0,0,0,0.05)',
          border: isAlreadyMember
            ? '1.5px solid rgba(181,147,90,0.30)'
            : '1.5px solid rgba(0,0,0,0.08)',
        }}
      >
        {isAlreadyMember ? (
          <CheckCircle size={26} strokeWidth={1.5} style={{ color: '#B5935A' }} />
        ) : (
          <AlertCircle size={26} strokeWidth={1.5} style={{ color: '#999' }} />
        )}
      </div>

      {/* Headline */}
      <h2
        className="text-[1.375rem] font-bold mb-2 leading-snug"
        style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
      >
        {headline}
      </h2>

      {/* Body */}
      <p className="text-[0.9375rem] mb-6 leading-relaxed" style={{ color: '#666' }}>
        {isAlreadyMember && joinedDateStr
          ? `You joined on ${joinedDateStr}.`
          : meta.body}
      </p>

      {/* Primary CTA */}
      <GoldButton
        onClick={handleCta}
        loading={isLoading}
        loadingText="Sending request..."
        className="mb-3"
      >
        {ctaLabel}
      </GoldButton>

      {/* Secondary: go home */}
      {!isAlreadyMember && (
        <button
          onClick={onGoHome}
          className="text-sm transition-opacity hover:opacity-70 underline"
          style={{ color: '#999', fontFamily: 'var(--font-body)' }}
        >
          Go to colorsofglory.app
        </button>
      )}
    </div>
  );
};

export default InviteErrorCard;
