import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

type CollabRole = "Viewer" | "Contributor" | "Reviewer";

interface Collaborator {
  initials: string;
  name: string;
  role: string;
  color: string;
}

const COLLABORATORS: Collaborator[] = [
  { initials: "PK", name: "Parker", role: "Owner", color: "#B8953A" },
  { initials: "SM", name: "Sarah M.", role: "Contributor", color: "#53AB8B" },
  { initials: "CR", name: "Caleb R.", role: "Reviewer", color: "#8070C4" },
];

const ROLES: CollabRole[] = ["Viewer", "Contributor", "Reviewer"];

const roleDescriptions: Record<CollabRole, string> = {
  Viewer: "Can listen and read only",
  Contributor: "Can add lyrics, memos, and ideas",
  Reviewer: "Can comment and approve changes",
};

const PeoplePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const [selectedRole, setSelectedRole] = useState<CollabRole>("Contributor");
  const [contact, setContact] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSend = () => {
    if (!contact.trim()) return;
    setIsSent(true);
  };

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

        {/* Invite form or Success */}
        {isSent ? (
          <div className="flex flex-col items-center text-center py-8 mb-8">
            <div
              className="flex items-center justify-center rounded-full mb-6"
              style={{
                width: 72,
                height: 72,
                backgroundColor: "rgba(184,149,58,0.12)",
                border: "1.5px solid rgba(184,149,58,0.30)",
              }}
            >
              <CheckCircle2 size={34} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
            </div>

            <h1
              className="text-3xl font-semibold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
            >
              Invitation Sent!
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--cog-warm-gray)" }}>
              Grace in the Waiting · {selectedRole}
            </p>

            <button
              onClick={() => navigate(`/songs/${songId}`)}
              className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
              }}
            >
              Return to song
            </button>
          </div>
        ) : (
          <>
            <h1
              className="text-3xl font-semibold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
            >
              Invite someone into this song
            </h1>

            <p className="text-base mb-8" style={{ color: "var(--cog-warm-gray)" }}>
              They can listen, write, comment, or review depending on the role you choose.
            </p>

            {/* Contact input */}
            <div className="mb-6">
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full rounded-2xl px-4 py-4 text-base outline-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--cog-cream-light)",
                  border: contact
                    ? "1.5px solid var(--cog-gold)"
                    : "1.5px solid var(--cog-border)",
                  color: "var(--cog-charcoal)",
                  fontFamily: "var(--font-body)",
                  boxShadow: contact ? "0 0 0 3px rgba(184,149,58,0.10)" : "none",
                }}
              />
            </div>

            {/* Role chips */}
            <p
              className="text-sm font-medium mb-3"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              Their role
            </p>
            <div className="flex gap-2.5 mb-2">
              {ROLES.map((role) => {
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.97]"
                    style={{
                      fontFamily: "var(--font-body)",
                      backgroundColor: isSelected ? "rgba(184,149,58,0.08)" : "var(--cog-cream-light)",
                      border: isSelected
                        ? "1.5px solid var(--cog-gold)"
                        : "1.5px solid var(--cog-border)",
                      color: isSelected ? "var(--cog-gold)" : "var(--cog-warm-gray)",
                      boxShadow: isSelected ? "0 0 0 3px var(--cog-gold-glow)" : "none",
                    }}
                  >
                    {role}
                  </button>
                );
              })}
            </div>

            {/* Role description */}
            <p className="text-xs mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
              {roleDescriptions[selectedRole]}
            </p>

            {/* CTA */}
            <button
              onClick={handleSend}
              disabled={!contact.trim()}
              className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40 mb-3"
              style={{
                backgroundColor: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                boxShadow: contact.trim() ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
              }}
            >
              Send invite
            </button>

            <p className="text-xs text-center mb-8" style={{ color: "var(--cog-muted)" }}>
              Invited songs do not use their free song.
            </p>
          </>
        )}

        {/* Current collaborators */}
        <div>
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            In this song
          </h2>

          <div className="flex flex-col gap-3">
            {COLLABORATORS.map((collab) => (
              <div
                key={collab.name}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{
                  backgroundColor: "var(--cog-cream-light)",
                  border: "1.5px solid var(--cog-border)",
                }}
              >
                {/* Avatar */}
                <div
                  className="flex items-center justify-center rounded-full text-sm font-semibold flex-shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: `${collab.color}20`,
                    color: collab.color,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {collab.initials}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    {collab.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                    {collab.role}
                  </p>
                </div>

                {collab.role !== "Owner" && (
                  <button
                    className="flex items-center justify-center transition-opacity hover:opacity-70"
                    style={{ color: "var(--cog-gold)" }}
                    aria-label={`Edit ${collab.name}'s role`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <SongTabBar activeTab="people" />
    </div>
  );
};

export default PeoplePage;
