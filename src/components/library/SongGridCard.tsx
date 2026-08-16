import { Mic, Pin, Check } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import { relativeDate, coverColor } from "@/lib/library/format";
import { songStatusChip } from "@/lib/library/songStatus";
import { useDedication } from "@/lib/songs/dedication";
import { useLongPress } from "./useLongPress";
import StatusChip from "./StatusChip";
import MiniFaceStack, { type MiniFace } from "./MiniFaceStack";

interface SongGridCardProps {
  song: SongRow;
  /** Compact = the denser 3-across grid (Apple Photos pinched-in). */
  compact?: boolean;
  onClick: () => void;
  /** Press-and-hold (or right-click) → the song's contextual actions. */
  onLongPress?: () => void;
  /** Held at the top of the library (Apple Notes). */
  pinned?: boolean;
  /** Batch-select mode active (Apple Photos): tap toggles instead of opens. */
  selecting?: boolean;
  selected?: boolean;
  /** THE BAND SHELF's Drive signal: the OTHER people in this song, as tiny
   *  faces. Absent/empty → the plain "N people / Just you" text stands. */
  people?: MiniFace[];
  /** Activity truth (the Drive standard): who touched the song last +
   *  whether there's anything you haven't seen. Absent → plain date. */
  pulse?: { unseen: number; line: string | null; sentence: string | null };
}

/**
 * SongGridCard — one song as a tactile creative room (never a file tile).
 * Two densities: comfortable (2-across) shows the full room; compact
 * (3-across) keeps title + ideas so more of the catalog fits one glance.
 */
const SongGridCard = ({
  song,
  compact = false,
  onClick,
  onLongPress,
  pinned = false,
  selecting = false,
  selected = false,
  people,
  pulse,
}: SongGridCardProps) => {
  // The song's quiet "for …" — display-only here (the card is a button; the
  // workspace header is the edit surface). Invisible when unset, and omitted
  // in the pinched-in compact density.
  const { text: dedication } = useDedication(song.id, song.dedication ?? undefined);
  // Hooks are UNCONDITIONAL (React law): gate the CALLBACK, never the call —
  // the conditional spread this replaces white-screened batch-select.
  const longPress = useLongPress(selecting ? undefined : onLongPress);
  return (
  <button
    onClick={onClick}
    {...longPress}
    aria-label={
      selecting
        ? `${selected ? "Deselect" : "Select"} ${song.title}`
        : [
            `Open ${song.title}`,
            `${song.voice_memo_count} ${song.voice_memo_count === 1 ? "idea" : "ideas"}`,
            people && people.length > 0 ? `with ${people.map((p) => p.name).join(", ")}` : null,
            pulse?.unseen ? `${pulse.unseen} new since you were here` : null,
            pulse?.sentence ?? `last edited ${relativeDate(song.last_activity_at)}`,
          ]
            .filter(Boolean)
            .join(", ")
    }
    aria-pressed={selecting ? selected : undefined}
    className="group relative text-left w-full select-none rounded-2xl flex flex-col justify-between bg-white border border-[var(--cog-border)] shadow-[0_2px_8px_rgba(28,26,23,0.06)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-[var(--cog-border-gold)] hover:shadow-[0_16px_32px_-16px_rgba(184,149,58,0.32)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cog-gold)]"
    style={{
      minHeight: compact ? 104 : 140,
      padding: compact ? 12 : 16,
      WebkitTouchCallout: "none",
      // Selected ring overrides the border utility while batch-selecting.
      ...(selected ? { border: "1.5px solid var(--cog-gold)" } : null),
    }}
  >
    {selecting && (
      <span
        aria-hidden
        className="absolute right-2 top-2 z-10 flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: 22,
          height: 22,
          backgroundColor: selected ? "var(--cog-gold)" : "rgba(255,255,255,0.9)",
          border: selected ? "none" : "1.5px solid var(--cog-muted)",
          boxShadow: "0 1px 3px rgba(28,26,23,0.15)",
        }}
      >
        {selected && <Check size={13} strokeWidth={3} color="white" />}
      </span>
    )}
    <div className="w-full">
      {/* Cover swatch + calm status chip (PV11: Active · Collaborating · Draft) */}
      <div className="mb-2.5 flex w-full items-start justify-between">
        <div
          aria-hidden
          className="rounded-lg"
          style={{
            width: compact ? 18 : 26,
            height: compact ? 18 : 26,
            background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
            border: "1px solid var(--cog-border)",
          }}
        />
        <span className="flex items-center gap-1.5" style={{ opacity: selecting ? 0 : 1 }}>
          {pinned && (
            <Pin
              size={compact ? 10 : 12}
              strokeWidth={2.2}
              fill="var(--cog-gold)"
              style={{ color: "var(--cog-gold)" }}
              aria-label="Pinned"
            />
          )}
          {!compact && <StatusChip spec={songStatusChip(song)} />}
        </span>
      </div>

      <p
        className={`font-bold leading-snug text-[var(--cog-charcoal)] transition-colors duration-200 group-hover:text-[var(--cog-gold)] ${
          compact ? "text-[0.8125rem] mb-1 line-clamp-2" : "text-[0.9375rem] mb-2"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {song.title}
      </p>

      {!compact && dedication && (
        <p
          className="italic text-[0.75rem] leading-snug line-clamp-1 -mt-1 mb-2"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          for {dedication}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <Mic size={compact ? 10 : 11} style={{ color: "var(--cog-gold)" }} />
        <span
          className={`font-medium ${compact ? "text-[0.6875rem]" : "text-[0.75rem]"}`}
          style={{ color: "var(--cog-muted)" }}
        >
          {song.voice_memo_count} {song.voice_memo_count === 1 ? "idea" : "ideas"}
        </span>
      </div>
    </div>

    {!compact && (
      <div className="flex w-full items-end justify-between mt-3">
        {people && people.length > 0 ? (
          <MiniFaceStack people={people} />
        ) : (
          <span className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
            {song.collaborator_count > 1 ? `${song.collaborator_count} people` : "Just you"}
          </span>
        )}
        {pulse?.line ? (
          <p
            className="flex min-w-0 items-center gap-1 text-[0.6875rem]"
            style={{ color: pulse.unseen > 0 ? "var(--cog-warm-gray)" : "var(--cog-muted)", marginLeft: 6 }}
            title={pulse.sentence ?? undefined}
          >
            {/* Decorative here — the card button's own label carries the
                "N new" truth (inner roles inside a labelled button are dead
                to the accessibility tree). */}
            {pulse.unseen > 0 && (
              <span
                aria-hidden="true"
                className="rounded-full"
                style={{ width: 7, height: 7, backgroundColor: "var(--cog-gold)", flexShrink: 0 }}
              />
            )}
            <span className="truncate" style={{ minWidth: 0 }}>{pulse.line}</span>
          </p>
        ) : (
          <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
            {relativeDate(song.last_activity_at)}
          </p>
        )}
      </div>
    )}
  </button>
  );
};

export default SongGridCard;
