import { useEffect, useRef, useState } from "react";
import { saveDedicationDurable, DEDICATION_MAX } from "@/lib/songs/dedication";

interface DedicationOfferProps {
  songId: string;
  songTitle: string;
  /** Fired when the moment resolves (saved or skipped) — the offer never returns. */
  onDone: () => void;
}

const OFFER_KEY = (songId: string) => `cog-dedication-offered:${songId}`;

/** Has the one-time birth offer already been shown for this song? */
export function dedicationOfferSeen(songId: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OFFER_KEY(songId)) === "1";
  } catch {
    return false;
  }
}

function markOfferSeen(songId: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(OFFER_KEY(songId), "1");
  } catch {
    /* the marker is a courtesy; worst case is one extra gentle offer */
  }
}

/**
 * DedicationOffer — the one gentle question at a song's birth: "Who is this
 * song for?" Shown exactly once, right after the first capture of a NEW song
 * lands (the idea is already safe — this blocks nothing and gates nothing).
 * Saving writes offline-first through lib/songs/dedication; skipping costs
 * nothing and is never asked again — the song header stays the always-open
 * door. Non-modal, dismissable, calm: an invitation, not a form.
 */
const DedicationOffer = ({ songId, songTitle, onDone }: DedicationOfferProps) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The marker lands the moment the offer exists, so a re-render, reload, or
  // return trip can never re-prompt — "offered once" is structural.
  useEffect(() => {
    markOfferSeen(songId);
  }, [songId]);

  const save = () => {
    saveDedicationDurable(songId, value);
    onDone();
  };

  return (
    <div
      role="group"
      aria-label={`Who is “${songTitle}” for?`}
      className="mb-5 rounded-2xl cog-dedication-offer"
      style={{
        padding: 16,
        background: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border)",
      }}
    >
      <p
        className="m-0 text-[0.9375rem]"
        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
      >
        Who is this song for?
      </p>
      <p
        className="m-0 mt-1 text-[0.8125rem] italic"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        “{songTitle}” can quietly remember — and you can always add or change this later.
      </p>

      <input
        ref={inputRef}
        type="text"
        value={value}
        maxLength={DEDICATION_MAX}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="the youth night · the Sunday after Mom's surgery"
        aria-label="Song dedication"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        className="mt-3 w-full rounded-xl"
        // 16px so iOS Safari never zooms the page when the field is focused.
        style={{
          minHeight: 44,
          padding: "0 12px",
          fontSize: 16,
          fontFamily: "var(--font-body)",
          color: "var(--cog-charcoal)",
          background: "white",
          border: "1px solid var(--cog-border)",
          caretColor: "var(--cog-gold)",
        }}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={value.trim().length === 0}
          className="rounded-xl text-sm font-semibold transition-transform active:scale-95 disabled:opacity-40"
          style={{
            minHeight: 44,
            padding: "0 18px",
            background: "var(--cog-gold)",
            color: "var(--cog-cream-light, #faf7f2)",
            border: "none",
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm underline underline-offset-2 transition-transform active:scale-95"
          style={{
            minHeight: 44,
            padding: "0 8px",
            background: "transparent",
            border: "none",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            cursor: "pointer",
          }}
        >
          Skip for now
        </button>
      </div>

      <style>{`
        .cog-dedication-offer { animation: cog-dedication-in 280ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)); }
        @keyframes cog-dedication-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .cog-dedication-offer { animation: none; } }
      `}</style>
    </div>
  );
};

export default DedicationOffer;
