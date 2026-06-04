import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Music, Users, CheckCircle2 } from "lucide-react";
import { acceptInvite, previewInvite, CogError, type InvitePreview } from "@/integrations/cog/songs";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  collaborator: "Contributor",
  viewer: "Viewer",
};

const ACCEPT_ERROR_COPY: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to open this song.",
  INVITE_NOT_FOUND: "This invite link is no longer valid.",
  INVITE_EXPIRED: "This invite has expired. Ask for a fresh link.",
  INVITE_ALREADY_USED: "This invite has already been used.",
  INVITE_EXHAUSTED: "This invite has reached its limit.",
  INTERNAL: "Something went wrong. Please try again.",
};

const PREVIEW_ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "This invite link is missing or malformed.",
  INVITE_NOT_FOUND: "This invite link is no longer valid.",
  INVITE_EXPIRED: "This invite has expired. Ask for a fresh link.",
  INVITE_REVOKED: "This invite was revoked.",
  INTERNAL: "We could not load this invite. Please try again.",
};

const InvitePreviewPage = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError(PREVIEW_ERROR_COPY.INVITE_NOT_FOUND);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await previewInvite(token);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof CogError ? err.code : "INTERNAL";
        setPreviewError(PREVIEW_ERROR_COPY[code] ?? PREVIEW_ERROR_COPY.INTERNAL);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await acceptInvite(token);
      if (res.already_member) {
        // Show the "already active" confirmation, then navigate in.
        setAlreadyActive(true);
        setTimeout(() => navigate(`/songs/${res.song_id}`), 1200);
        return;
      }
      navigate(`/songs/${res.song_id}`);
    } catch (err) {
      const code = err instanceof CogError ? err.code : "INTERNAL";
      setAcceptError(ACCEPT_ERROR_COPY[code] ?? ACCEPT_ERROR_COPY.INTERNAL);
      setAccepting(false);
    }
  };

  const roleLabel = invite ? ROLE_LABEL[invite.role] ?? invite.role : "";

  const renderError = (message: string) => (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border)",
        boxShadow: "var(--cog-shadow-card)",
      }}
    >
      <p
        className="text-lg mb-2"
        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
      >
        {message}
      </p>
      <button
        onClick={() => navigate("/")}
        className="mt-4 text-sm underline"
        style={{ color: "var(--cog-warm-gray)" }}
      >
        Go to your songs
      </button>
    </div>
  );

  const renderSkeleton = () => (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
    >
      <div className="h-5 w-2/3 rounded-full mb-3" style={{ background: "rgba(184,149,58,0.12)" }} />
      <div className="h-4 w-1/2 rounded-full mb-6" style={{ background: "rgba(28,26,23,0.06)" }} />
      <div className="h-4 w-1/3 rounded-full" style={{ background: "rgba(28,26,23,0.06)" }} />
    </div>
  );

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
            "radial-gradient(ellipse 70% 55% at 50% 80%, rgba(184,149,58,0.14) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pt-24 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Brand */}
        <p
          className="text-sm font-medium tracking-widest uppercase mb-12 text-center"
          style={{ color: "var(--cog-muted)" }}
        >
          Colors of Glory
        </p>

        {/* Headline */}
        <h1
          className="text-4xl font-semibold mb-2 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          {alreadyActive ? "You're already in" : "You have been invited"}
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          {alreadyActive
            ? "Opening the song now…"
            : "Open the song and start collaborating."}
        </p>

        {loading && <div className="mb-8">{renderSkeleton()}</div>}

        {!loading && previewError && renderError(previewError)}

        {!loading && invite && (
          <>
            <div
              className="rounded-2xl p-5 mb-8"
              style={{
                background:
                  "linear-gradient(145deg, var(--cog-cream-light) 0%, rgba(232,213,160,0.25) 100%)",
                border: "1.5px solid var(--cog-border-gold)",
                boxShadow: "var(--cog-shadow-card)",
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    backgroundColor: "rgba(184,149,58,0.12)",
                    border: "1px solid rgba(184,149,58,0.22)",
                  }}
                >
                  <Music size={24} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
                </div>
                <div>
                  <p
                    className="text-xl font-semibold leading-snug mb-1"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                  >
                    {invite.song_title}
                  </p>
                  <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                    Invited by{" "}
                    <span style={{ color: "var(--cog-charcoal)", fontWeight: 500 }}>
                      {invite.inviter_name}
                    </span>
                  </p>
                </div>
              </div>

              <div
                className="flex items-center justify-between pt-4"
                style={{ borderTop: "1px solid var(--cog-border)" }}
              >
                <div className="flex items-center gap-1.5">
                  <Users size={14} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
                  <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                    {invite.collaborator_count} collaborator
                    {invite.collaborator_count === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(184,149,58,0.15)",
                    color: "var(--cog-gold-alt)",
                  }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>

            {alreadyActive && (
              <div
                className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-6"
                style={{
                  background: "rgba(184,149,58,0.10)",
                  border: "1px solid var(--cog-border-gold)",
                }}
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 size={18} style={{ color: "var(--cog-gold)" }} />
                <p className="text-sm" style={{ color: "var(--cog-charcoal)" }}>
                  You&rsquo;re already in this song &mdash; opening now.
                </p>
              </div>
            )}

            {acceptError && !alreadyActive && (
              <div
                className="rounded-2xl px-4 py-3 mb-6 text-sm text-center"
                style={{
                  background: "rgba(184,149,58,0.06)",
                  border: "1px solid var(--cog-border)",
                  color: "var(--cog-charcoal)",
                }}
                role="alert"
              >
                {acceptError}
              </div>
            )}

            <p className="text-xs text-center mb-8" style={{ color: "var(--cog-muted)" }}>
              Invited songs do not use your free song.
            </p>

            <button
              onClick={handleAccept}
              disabled={accepting || alreadyActive}
              className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-4 disabled:opacity-60"
              style={{
                backgroundColor: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                boxShadow: "0 4px 20px rgba(184,149,58,0.40)",
              }}
            >
              {alreadyActive
                ? "Opening…"
                : accepting
                  ? "Opening song…"
                  : "Open song"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePreviewPage;
