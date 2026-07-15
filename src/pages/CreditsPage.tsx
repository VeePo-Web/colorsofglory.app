import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Crown } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import { useSongCollaborators } from "@/lib/invite/useSongCollaborators";
import { useDedication } from "@/lib/songs/dedication";
import { deriveCredits, creditsToText } from "@/lib/canvas/credits";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { copyTextToClipboard } from "@/lib/invite/clipboard";

interface DisplayCredit {
  key: string;
  initials: string;
  name: string;
  role: string;
  color: string;
  isOwner: boolean;
  contributions: string[];
}

/**
 * Credits (COG Product 13). Every contributor's work, remembered — derived
 * from the real song room (canvas cards) and enriched with the live roster
 * for roles + the owner crown. Export copies a plain-text credits block to
 * the clipboard so it can be pasted into liner notes, a bio, anywhere.
 */
const CreditsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const members = useSongCollaborators(songId);
  // The song's "for …" — a top-line on the sheet and in the export.
  const { text: dedication } = useDedication(songId);
  const [copied, setCopied] = useState(false);

  const credits = useMemo<DisplayCredit[]>(() => {
    const derived = deriveCredits(songId);
    // Match a card-contributor name to a real member (full name or first name).
    const memberFor = (name: string) =>
      members.find(
        (m) => `${m.firstName} ${m.lastName}`.trim() === name || m.firstName === name,
      );

    const list: DisplayCredit[] = derived.map((entry) => {
      const m = memberFor(entry.name);
      return {
        key: entry.name,
        name: entry.name,
        contributions: entry.contributions,
        role: m ? m.role : "Contributor",
        isOwner: m?.isOwner ?? false,
        color: m?.avatarColor ?? getCreatorColor(entry.name).base,
        initials: m?.avatarInitials ?? getCreatorInitials(entry.name),
      };
    });

    // Surface members who are in the room but haven't added a card yet, so the
    // roster feels complete (they're credited as present, no contributions).
    for (const m of members) {
      const full = `${m.firstName} ${m.lastName}`.trim();
      if (!list.some((c) => c.name === full || c.name === m.firstName)) {
        list.push({
          key: m.userId,
          name: full || m.firstName,
          contributions: [],
          role: m.role,
          isOwner: m.isOwner,
          color: m.avatarColor,
          initials: m.avatarInitials,
        });
      }
    }

    // Owner first, then by contribution volume.
    return list.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return b.contributions.length - a.contributions.length;
    });
  }, [songId, members]);

  const handleExport = async () => {
    const ok = await copyTextToClipboard(creditsToText(songTitle, credits, dedication));
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 88 }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)" }}
      />

      <div className="relative flex flex-col flex-1 px-6 pb-12" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}>
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}/canvas`)}
            className="flex min-h-11 items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
            style={{ color: "var(--cog-warm-gray)" }}
            aria-label="Back to the song canvas"
          >
            <ArrowLeft size={15} />
            Song
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}>
          Credits
        </h1>
        <p className="text-sm mb-1" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          {songTitle}
        </p>
        {/* The dedication is how the song is OFFERED, not a contribution —
            a quiet top-line above the ledger, never a row in it. Omitted
            entirely when unset. */}
        {dedication && (
          <p className="text-sm italic mb-1" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
            for {dedication}
          </p>
        )}
        <p className="text-sm mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          Every contribution remembered.
        </p>

        {credits.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center mb-8"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
          >
            <p className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
              No contributions yet
            </p>
            <p className="text-sm" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              As you and your co-writers add ideas, everyone's work is credited here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-8">
            {credits.map((credit) => (
              <div
                key={credit.key}
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: "var(--cog-cream-light)",
                  border: credit.isOwner ? "1.5px solid var(--cog-border-gold)" : "1.5px solid var(--cog-border)",
                  boxShadow: credit.isOwner ? "0 4px 20px rgba(184,149,58,0.12)" : "0 4px 16px rgba(28,26,23,0.06)",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex items-center justify-center rounded-full text-sm font-semibold flex-shrink-0"
                    style={{ width: 44, height: 44, backgroundColor: `${credit.color}20`, color: credit.color, fontFamily: "var(--font-body)" }}
                  >
                    {credit.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                        {credit.name}
                      </p>
                      {credit.isOwner && <Crown size={14} style={{ color: "var(--cog-gold)" }} />}
                    </div>
                    <p className="text-xs" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                      {credit.role}
                    </p>
                  </div>
                </div>

                {credit.contributions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {credit.contributions.map((contribution) => (
                      <span
                        key={contribution}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${credit.color}14`, color: credit.color, border: `1px solid ${credit.color}30`, fontFamily: "var(--font-body)" }}
                      >
                        {contribution}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
                    In the room
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={credits.length === 0}
          className="w-full py-4 rounded-2xl font-medium text-base transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          style={{
            backgroundColor: copied ? "#53AB8B" : "var(--cog-cream-light)",
            border: copied ? "1.5px solid #53AB8B" : "1.5px solid var(--cog-border)",
            color: copied ? "#FFFFFF" : "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
          }}
          aria-label="Copy credits to clipboard"
        >
          <span className="flex items-center justify-center gap-2">
            {copied ? (
              <><Check size={16} strokeWidth={2.2} /> Credits copied</>
            ) : (
              <><Copy size={16} strokeWidth={1.8} style={{ color: "var(--cog-warm-gray)" }} /> Copy credits</>
            )}
          </span>
        </button>
        <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {copied ? "Credits copied to clipboard" : ""}
        </span>
      </div>

      <SongTabBar activeTab="people" />
    </div>
  );
};

export default CreditsPage;
