import { useState } from "react";
import type { AddIdeaInput, IdeaCardType } from "@/lib/canvas/canvasTypes";

interface AddIdeaSheetProps {
  onSave: (input: AddIdeaInput) => void;
  onClose: () => void;
}

const AddIdeaSheet = ({ onSave, onClose }: AddIdeaSheetProps) => {
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState("");
  const [type, setType] = useState<IdeaCardType>("lyric");

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Add idea to this song"
      className="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] px-5 pb-6 pt-5 md:left-auto md:right-5 md:top-24 md:w-[360px] md:rounded-[24px] md:pb-5"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border)",
        boxShadow: "0 -18px 45px rgba(28,26,23,0.18)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
            Capture first
          </p>
          <h2 className="text-xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
            Add idea to this song
          </h2>
        </div>
        <button type="button" onClick={onClose} className="min-h-10 rounded-full px-3 text-sm" style={{ color: "var(--cog-warm-gray)" }}>
          Close
        </button>
      </div>

      <label className="mb-3 block text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
        Idea type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as IdeaCardType)}
          className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          style={{ borderColor: "var(--cog-border)" }}
        >
          <option value="lyric">Lyric</option>
          <option value="voice">Voice memo</option>
          <option value="chord">Chord idea</option>
          <option value="note">Note</option>
          <option value="scripture">Scripture</option>
          <option value="story">Story</option>
        </select>
      </label>

      <label className="mb-3 block text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
        Idea title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          style={{ borderColor: "var(--cog-border)" }}
          placeholder="Bridge lift"
        />
      </label>

      <label className="mb-4 block text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
        Idea preview
        <textarea
          value={preview}
          onChange={(event) => setPreview(event.target.value)}
          className="mt-2 min-h-[86px] w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm"
          style={{ borderColor: "var(--cog-border)" }}
          placeholder="Save the idea first. Shape it later."
        />
      </label>

      <button
        type="button"
        onClick={() => onSave({ title, preview, type })}
        className="min-h-12 w-full rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
        style={{ backgroundColor: "var(--cog-gold)", boxShadow: "var(--cog-shadow-fab)" }}
      >
        Save idea
      </button>
    </section>
  );
};

export default AddIdeaSheet;
