import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

interface ActivityItem {
  id: string;
  initials: string;
  avatarColor: string;
  action: string;
  sub: string;
  timestamp: string;
  isPending?: boolean;
  isComment?: boolean;
}

const ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    initials: "SM",
    avatarColor: "#53AB8B",
    action: "Sarah added a voice memo",
    sub: "Verse 2 · First melody idea · 0:12",
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    initials: "PK",
    avatarColor: "#B8953A",
    action: "Parker edited Verse 2",
    sub: "Changed line 3: Grace in the storm...",
    timestamp: "4 hours ago",
  },
  {
    id: "3",
    initials: "CR",
    avatarColor: "#8070C4",
    action: "Caleb suggested a chord change",
    sub: "Verse 1: Am → Em suggestion pending",
    timestamp: "Yesterday",
    isPending: true,
  },
];

const ActivityPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogLogo size="sm" />
        </div>

        {/* Headline */}
        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          What changed since you left
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          Grace in the Waiting · 3 changes
        </p>

        {/* Activity cards */}
        <div className="flex flex-col gap-3 mb-6">
          {ACTIVITY.map((item) => (
            <button
              key={item.id}
              className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1.5px solid var(--cog-border)",
                boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
                borderLeft: `3px solid ${item.avatarColor}`,
              }}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: `${item.avatarColor}22`,
                    color: item.avatarColor,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {item.initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-sm font-semibold leading-snug"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                    >
                      {item.action}
                    </p>
                    <span
                      className="text-xs flex-shrink-0"
                      style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
                    >
                      {item.timestamp}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  >
                    {item.sub}
                  </p>
                  {item.isPending && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2"
                      style={{
                        backgroundColor: "rgba(128,112,196,0.12)",
                        color: "#8070C4",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Pending review
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Comments card */}
          <button
            className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.98]"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
              boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
              borderLeft: "3px solid var(--cog-gold)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(184,149,58,0.12)",
                  color: "var(--cog-gold)",
                }}
              >
                <MessageSquare size={16} strokeWidth={1.6} />
              </div>
              <div className="flex-1">
                <p
                  className="text-sm font-semibold leading-snug"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                >
                  2 comments need review
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                >
                  Tap to see all comments in the song
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* CTAs */}
        <button
          onClick={() => navigate(`/songs/${songId}`)}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-3"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          Review changes
        </button>

        <button
          onClick={() => navigate(`/songs/${songId}`)}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Open song
        </button>
      </div>
      <SongTabBar activeTab="people" />
    </div>
  );
};

export default ActivityPage;
