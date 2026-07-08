import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, RotateCcw, ShieldCheck } from "lucide-react";
import { findOriginalId, type SongVersion } from "@/integrations/cog/versions";
import {
  useEnsureOriginal,
  useMembersById,
  useRestoreVersion,
  useSaveVersion,
  useSongVersions,
  useVersionCapabilities,
} from "@/components/versions/useSongVersions";
import VersionTimeline from "@/components/versions/VersionTimeline";
import VersionDetailSheet from "@/components/versions/VersionDetailSheet";
import SaveVersionSheet from "@/components/versions/SaveVersionSheet";
import RestoreConfirmSheet from "@/components/versions/RestoreConfirmSheet";

/**
 * /songs/:id/versions — the snapshot timeline (E3, Product Vision 09 / F24).
 * Every meaningful state of the song, newest first; the Original protected at
 * the root. Restore is non-destructive (the seam saves the current state
 * first), so the page can offer Undo with a straight face.
 */

type UndoState = {
  /** The pre-restore safety version — restoring it IS undo. */
  preId: string;
  preNumber: number;
  restoredFromNumber: number;
};

const VersionHistoryPage = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "";
  const navigate = useNavigate();

  const { data: versions, isLoading, error } = useSongVersions(songId);
  const caps = useVersionCapabilities(songId);
  const membersById = useMembersById(songId);
  useEnsureOriginal(songId, versions, caps.canSave);

  const saveVersion = useSaveVersion(songId);
  const restore = useRestoreVersion(songId);

  const [openVersion, setOpenVersion] = useState<SongVersion | null>(null);
  const [confirmVersion, setConfirmVersionState] = useState<SongVersion | null>(null);
  const setConfirmVersion = (v: SongVersion | null) => {
    if (v) restore.reset(); // a fresh confirm never shows a stale error
    setConfirmVersionState(v);
  };
  const [showSave, setShowSave] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const originalId = useMemo(() => findOriginalId(versions ?? []), [versions]);
  const headId = versions?.[0]?.id ?? null;
  const original = versions?.find((v) => v.id === originalId) ?? null;

  const handleRestore = (version: SongVersion) => {
    restore.mutate(version.id, {
      onSuccess: (result) => {
        setConfirmVersionState(null);
        setOpenVersion(null);
        setUndo({
          preId: result.preRestoreVersion.id,
          preNumber: result.preRestoreVersion.version_number,
          restoredFromNumber: version.version_number,
        });
      },
    });
  };

  const handleUndo = () => {
    if (!undo || isUndoing) return;
    setIsUndoing(true);
    restore.mutate(undo.preId, {
      onSuccess: () => setUndo(null),
      onSettled: () => setIsUndoing(false),
    });
  };

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ backgroundColor: "var(--cog-cream)", maxWidth: "var(--max-w-app)", marginInline: "auto" }}
    >
      {/* Warm glow — the active-song signature */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 40% at 50% 85%, rgba(184,149,58,0.14) 0%, transparent 70%)",
        }}
      />

      <header
        className="flex items-center gap-3 px-5 pb-3 flex-shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button
          type="button"
          onClick={() => navigate(`/songs/${songId}/room`)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)" }}
          aria-label="Back to song"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
        <h1
          className="font-bold flex-1"
          style={{ fontSize: 17, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
        >
          Version History
        </h1>
        {caps.canSave && (
          <button
            type="button"
            onClick={() => setShowSave(true)}
            className="active:scale-[0.97] transition-transform"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 38,
              paddingInline: 14,
              borderRadius: 999,
              backgroundColor: "var(--cog-gold)",
              color: "#FFF",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Bookmark size={14} strokeWidth={2.5} aria-hidden="true" />
            Save a version
          </button>
        )}
      </header>

      <p className="px-5" style={{ margin: 0, fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.55 }}>
        Every version of this song is kept safe here. Restoring never overwrites — nothing is ever lost.
      </p>

      {/* Undo bar after a restore */}
      {undo && (
        <div
          role="status"
          aria-live="polite"
          className="mx-5 mt-4 flex items-center justify-between gap-3"
          style={{
            borderRadius: 14,
            backgroundColor: "var(--cog-gold-glow)",
            border: "1px solid var(--cog-border-gold)",
            padding: "10px 14px",
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--cog-charcoal)", lineHeight: 1.5 }}>
            Restored from v{undo.restoredFromNumber}. Your previous version is safe as v{undo.preNumber}.
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              minHeight: 34,
              paddingInline: 12,
              borderRadius: 999,
              backgroundColor: "transparent",
              border: "1.5px solid var(--cog-border-gold)",
              color: "var(--cog-gold)",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isUndoing ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            <RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" />
            {isUndoing ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}

      <main className="flex-1 px-5" style={{ paddingTop: 20, paddingBottom: 32, position: "relative" }}>
        {isLoading ? (
          <p style={{ margin: 0, textAlign: "center", padding: "48px 0", fontSize: 14, color: "var(--cog-muted)" }}>
            Gathering your versions…
          </p>
        ) : error ? (
          <p style={{ margin: 0, textAlign: "center", padding: "48px 24px", fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}>
            We couldn't load the timeline just now. Your versions are safe — please try again in a moment.
          </p>
        ) : (
          <>
            <VersionTimeline
              versions={versions ?? []}
              originalId={originalId}
              membersById={membersById}
              onOpen={setOpenVersion}
            />

            {/* One-tap return to the original */}
            {caps.canRestore && original && (versions?.length ?? 0) > 1 && original.id !== headId && (
              <button
                type="button"
                onClick={() => setConfirmVersion(original)}
                className="mt-6 w-full active:scale-[0.98] transition-transform"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  borderRadius: 14,
                  backgroundColor: "transparent",
                  border: "1.5px solid var(--cog-border-gold)",
                  color: "var(--cog-gold)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <ShieldCheck size={16} strokeWidth={2.5} aria-hidden="true" />
                Return to the original
              </button>
            )}
          </>
        )}
      </main>

      {/* Sheets */}
      {openVersion && (
        <VersionDetailSheet
          version={openVersion}
          isOriginal={openVersion.id === originalId}
          member={membersById.get(openVersion.created_by_user_id)}
          canRestore={caps.canRestore}
          isCurrent={openVersion.id === headId}
          onRestore={() => setConfirmVersion(openVersion)}
          onClose={() => setOpenVersion(null)}
        />
      )}
      {confirmVersion && (
        <RestoreConfirmSheet
          version={confirmVersion}
          isRestoring={restore.isPending}
          error={restore.isError ? "We couldn't finish the restore. Nothing has been lost — every version is still on the timeline. Please try again." : null}
          onConfirm={() => handleRestore(confirmVersion)}
          onClose={() => {
            if (!restore.isPending) setConfirmVersionState(null);
          }}
        />
      )}
      {showSave && (
        <SaveVersionSheet
          isSaving={saveVersion.isPending}
          error={saveVersion.isError ? "We couldn't save that version. Please try again." : null}
          onSave={(label) =>
            saveVersion.mutate(
              { label },
              { onSuccess: () => setShowSave(false) },
            )
          }
          onClose={() => {
            if (!saveVersion.isPending) setShowSave(false);
          }}
        />
      )}
    </div>
  );
};

export default VersionHistoryPage;
