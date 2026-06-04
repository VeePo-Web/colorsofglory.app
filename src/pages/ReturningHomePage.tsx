import { useNavigate } from "react-router-dom";
import { CheckCircle2, Mic, HardDrive } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";

// Mock returning-user data — Lovable replaces with real Supabase query
const MOCK_RETURN = {
  firstName: 'Parker',
  lastSongTitle: 'Grace in the Waiting',
  lastSongId: '1',
  lastEditedLabel: '2 hours ago',
  songsNeedingReview: 3,
  newVoiceMemos: 1,
  storagePercent: 62,
};

interface InfoPillProps {
  icon: React.ElementType;
  label: string;
  accent?: boolean;
}

const InfoPill = ({ icon: Icon, label, accent }: InfoPillProps) => (
  <div
    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 w-full"
    style={{
      backgroundColor: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    }}
  >
    <Icon
      size={18}
      strokeWidth={1.6}
      style={{ color: accent ? '#B5935A' : '#666', flexShrink: 0 }}
    />
    <span className="text-[0.9375rem]" style={{ color: '#1A1A1A', fontFamily: 'var(--font-body)' }}>
      {label}
    </span>
  </div>
);

/**
 * Screen 18 — Returning User Home.
 * Shows the last song, pending reviews, new memos, and storage.
 * "Open last song" → /songs/:id/lyrics. "View all songs" → /.
 */
const ReturningHomePage = () => {
  const navigate = useNavigate();
  const data = MOCK_RETURN;

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: '#FAFAF6' }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.10) 0%, transparent 65%)' }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pt-16 pb-12 mx-auto w-full"
        style={{ maxWidth: 430 }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Welcome back */}
        <h1
          className="text-[2rem] font-bold text-center mb-8 leading-[1.05]"
          style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
        >
          Welcome back
        </h1>

        {/* Last song card — the main CTA */}
        <button
          onClick={() => navigate(`/songs/${data.lastSongId}/lyrics`)}
          className="w-full text-left rounded-2xl p-6 mb-5 transition-all duration-150 active:scale-[0.98]"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <p
            className="text-[0.75rem] font-semibold uppercase tracking-wide mb-2"
            style={{ color: '#999' }}
          >
            Continue
          </p>
          <p
            className="text-[1.5rem] font-bold leading-snug mb-2"
            style={{ fontFamily: 'var(--font-display)', color: '#1A1A1A' }}
          >
            {data.lastSongTitle}
          </p>
          <p className="text-[0.875rem]" style={{ color: '#999' }}>
            Last edited {data.lastEditedLabel}
          </p>
        </button>

        {/* Info pills */}
        <div className="flex flex-col gap-3 mb-8">
          {data.songsNeedingReview > 0 && (
            <InfoPill
              icon={CheckCircle2}
              label={`${data.songsNeedingReview} songs need review`}
              accent
            />
          )}
          {data.newVoiceMemos > 0 && (
            <InfoPill
              icon={Mic}
              label={`${data.newVoiceMemos} new voice memo`}
            />
          )}
          <InfoPill
            icon={HardDrive}
            label={`Storage: ${data.storagePercent}% used`}
          />
        </div>

        {/* Open last song — primary CTA */}
        <GoldButton onClick={() => navigate(`/songs/${data.lastSongId}/lyrics`)}>
          Open last song
        </GoldButton>

        {/* View all songs */}
        <button
          onClick={() => navigate('/')}
          className="text-[0.9375rem] text-center w-full py-4 transition-opacity hover:opacity-70"
          style={{ color: '#999', fontFamily: 'var(--font-body)' }}
        >
          View all songs
        </button>
      </div>
    </div>
  );
};

export default ReturningHomePage;
