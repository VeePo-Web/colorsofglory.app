import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { useSongTitle } from "@/lib/songContext";
import { CogError } from "@/integrations/cog/songs";
import {
  listSongVersions,
  restoreSongVersion,
  type SongVersion,
} from "@/integrations/cog/versions";
import { listMembers, myRole, type SongMember } from "@/integrations/cog/members";

// ─── Helpers (human language only — no commit hashes, no diffs) ────────────────

const KIND_LABEL: Record<SongVersion["kind"], string> = {
  manual: "Saved version",
  auto: "Autosave",
  restore_point: "Restored version",
};

function friendlyTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay) return `Today · ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MemberLite = { name: string; color: string; initials: string };

// ─── Page ──────────────────────────────────────────────────────────────────────

const VersionHistoryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);

  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [members, setMembers] = useState<Record<string, MemberLite>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setNotice(null);
    try {
      const [vs, ms, role] = await Promise.all([
        listSongVersions(songId),
        listMembers(songId).catch(() => [] as SongMember[]),
        myRole(songId).catch(() => null),
      ]);
      const map: Record<string, MemberLite> = {};
      for (const m of ms) {
        map[m.user_id] = {
          name: m.display_name ?? m.first_name ?? "A collaborator",
          color: m.avatar_color ?? "#B8953A",
          initials: m.initials,
        };
      }
      setVersions(vs);
      setMembers(map);
      setIsOwner(role === "owner");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [songId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Accessibility (PV09): focus moves into the restore dialog on open and
  // returns to the previously focused control on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (confirmOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else {
      prevFocusRef.current?.focus?.();
    }
  }, [confirmOpen]);

  const handleRestore = async () => {
    if (!selectedId || restoring) return;
    setRestoring(true);
    setNotice(null);
    try {
      await restoreSongVersion(songId, selectedId);
      setConfirmOpen(false);
      setRestored(true);
      setSelectedId(null);
      await load();
      window.setTimeout(() => setRestored(false), 4000);
    } catch (err) {
      setConfirmOpen(false);
      if (err instanceof CogError && err.code === "RESTORE_UNAVAILABLE") {
        setNotice("Restore is coming soon — your version history is safe.");
      } else {
        setNotice("We could not restore that version. Please try again.");
      }
    } finally {
      setRestoring(false);
    }
  };

  // Newest version is the current draft (not restorable); the rest are history.
  const [current, ...history] = versions;
  const hasHistory = history.length > 0;

  const actorOf = (uid: string): MemberLite =>
    members[uid] ?? { name: "A collaborator", color: "#B8953A", initials: "•" };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)" }}
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
            style={{ color: "var(--cog-warm-gray)", minHeight: 44 }}
          >
            <ArrowLeft size={15} /> Song
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Version history
        </h1>
        <p className="text-sm mb-1" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          {songTitle}
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          Explore freely — the song remembers every version.
        </p>

        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl"
                style={{ height: 84, backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)", opacity: 0.6 }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="rounded-2xl px-4 py-5 text-center" style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }} role="alert">
            <p className="text-sm mb-3" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
              We could not load version history. Check your connection and try again.
            </p>
            <button onClick={() => void load()} className="text-sm font-medium" style={{ color: "var(--cog-gold)", minHeight: 44 }}>
              Try again
            </button>
          </div>
        )}

        {/* Ready */}
        {status === "ready" && (
          <>
            {/* Empty state */}
            {versions.length === 0 && (
              <div className="rounded-2xl px-4 py-8 text-center" style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}>
                <p className="text-sm" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                  No versions yet. Your saved changes will appear here as the song grows.
                </p>
              </div>
            )}

            {/* Current version marker */}
            {current && (
              <div
                className="rounded-2xl px-4 py-4 mb-3"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border-gold)", boxShadow: "0 4px 20px rgba(184,149,58,0.12)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    {current.label ?? KIND_LABEL[current.kind]}
                  </p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)", color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}>
                    Current · Saved
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                  {actorOf(current.createdByUserId).name} · {friendlyTime(current.createdAt)}
                </p>
              </div>
            )}

            {/* History timeline */}
            {hasHistory && (
              <div className="flex flex-col gap-3 mb-2" role="radiogroup" aria-label="Earlier versions">
                {history.map((v) => {
                  const a = actorOf(v.createdByUserId);
                  const selected = selectedId === v.id;
                  return (
                    <button
                      key={v.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => isOwner && setSelectedId(selected ? null : v.id)}
                      disabled={!isOwner}
                      className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.99]"
                      style={{
                        backgroundColor: "var(--cog-cream-light)",
                        border: selected ? "1.5px solid var(--cog-border-gold)" : "1.5px solid var(--cog-border)",
                        boxShadow: selected ? "0 0 0 3px rgba(184,149,58,0.12), 0 4px 16px rgba(28,26,23,0.06)" : "0 4px 16px rgba(28,26,23,0.06)",
                        borderLeft: `3px solid ${a.color}`,
                        cursor: isOwner ? "pointer" : "default",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                          style={{ width: 36, height: 36, backgroundColor: `${a.color}22`, color: a.color, fontFamily: "var(--font-body)" }}
                        >
                          {a.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                            {v.label ?? KIND_LABEL[v.kind]}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                            {a.name} · {friendlyTime(v.createdAt)}
                          </p>
                          {v.description && (
                            <p className="text-xs mt-1" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
                              {v.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Owner-only restore affordance */}
            {hasHistory && !isOwner && (
              <p className="text-xs text-center mt-2" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
                You can view this history. Only the song owner can restore versions.
              </p>
            )}

            {notice && (
              <p className="text-sm text-center mt-4" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }} aria-live="polite">
                {notice}
              </p>
            )}

            {/* Restore CTA — only once a non-current version is selected */}
            {isOwner && selectedId && (
              <div className="mt-6">
                <GoldButton onClick={() => setConfirmOpen(true)}>
                  <RotateCcw size={16} strokeWidth={1.8} /> Restore version
                </GoldButton>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation sheet */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" style={{ backgroundColor: "rgba(28,26,23,0.32)" }} onClick={() => !restoring && setConfirmOpen(false)}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full rounded-t-3xl px-6 pt-6 outline-none"
            style={{ maxWidth: "var(--max-w-app)", backgroundColor: "var(--cog-cream-light)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape" && !restoring) setConfirmOpen(false); }}
            role="dialog"
            aria-modal="true"
            aria-label="Restore version"
          >
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
              Restore this version?
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              Your current draft stays safe in history. This brings the earlier version back as the latest.
            </p>
            <GoldButton onClick={handleRestore} loading={restoring} loadingText="Restoring...">
              Restore version
            </GoldButton>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={restoring}
              className="w-full text-center py-3 mt-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", minHeight: 44 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {restored && (
        <div className="fixed left-0 right-0 z-[650] flex justify-center px-6" style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }} aria-live="polite">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-3"
            style={{ backgroundColor: "var(--cog-charcoal)", color: "#FFFFFF", boxShadow: "0 8px 28px rgba(28,26,23,0.28)" }}
          >
            <Check size={16} strokeWidth={2} style={{ color: "#7BC9A6" }} />
            <span className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              Version restored. Your previous draft is still saved.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPage;
