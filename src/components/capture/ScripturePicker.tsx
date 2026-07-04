import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { parseReference, buildLabel, type ParsedRef } from "@/lib/scripture/parseReference";
import { fetchPassage, type ScripturePassage, type Translation } from "@/integrations/cog/scripture";

const TRANSLATIONS: { value: Translation; label: string }[] = [
  { value: "web", label: "WEB" },
  { value: "kjv", label: "KJV" },
  { value: "asv", label: "ASV" },
];
const STORAGE_KEY = "cog.scripture.translation";

interface ScripturePickerProps {
  onPicked: (label: string, text: string) => void;
  onFallback: () => void;
}

const ScripturePicker = ({ onPicked, onFallback }: ScripturePickerProps) => {
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParsedRef | null>(null);
  const [passage, setPassage] = useState<ScripturePassage | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<Translation>(() => {
    if (typeof window === "undefined") return "web";
    const t = window.localStorage.getItem(STORAGE_KEY) as Translation | null;
    return t === "kjv" || t === "asv" ? t : "web";
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, translation);
  }, [translation]);

  // Debounced parse + fetch.
  useEffect(() => {
    const next = parseReference(query);
    setParsed(next);
    if (!next) {
      setPassage(null);
      setError(null);
      return;
    }
    setError(null);
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const p = await fetchPassage(next.display, translation);
        setPassage(p);
        const preselect = next.verses
          ? new Set(
              p.verses
                .map((v) => v.verse)
                .filter((v) => v >= next.verses!.start && v <= next.verses!.end),
            )
          : new Set(p.verses.map((v) => v.verse));
        setSelected(preselect);
      } catch (e) {
        setPassage(null);
        setSelected(new Set());
        setError("Couldn't find that passage");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, translation]);

  const totalVerses = passage?.verses.length ?? 0;
  const selectedCount = selected.size;

  const statusLine = useMemo(() => {
    if (loading) return "Looking up…";
    if (error) return error;
    if (!parsed) return query.trim() ? `Try "Psalm 23" or "John 3:16-17"` : "Whole chapter by default.";
    if (!passage) return parsed.display;
    if (selectedCount === 0) return `${passage.canonical} · pick at least one verse`;
    if (selectedCount === totalVerses) return `${passage.canonical} · ${totalVerses} verses · all selected`;
    return `${passage.canonical} · ${selectedCount} of ${totalVerses} selected`;
  }, [loading, error, parsed, passage, query, selectedCount, totalVerses]);

  const toggleVerse = (n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const selectAll = () => passage && setSelected(new Set(passage.verses.map((v) => v.verse)));
  const selectFirst = () => passage && setSelected(new Set([passage.verses[0].verse]));
  const clearAll = () => setSelected(new Set());

  const canSave = passage && selectedCount > 0;
  const handleSave = () => {
    if (!passage || selectedCount === 0) return;
    const picked = passage.verses.filter((v) => selected.has(v.verse));
    const label = buildLabel(
      passage.book,
      passage.chapter,
      picked.map((v) => v.verse),
      totalVerses,
      passage.translation,
    );
    const text = picked.map((v) => `${v.verse} ${v.text}`).join("\n");
    onPicked(label, text);
  };

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {/* Translation pill */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, color: "var(--cog-warm-gray)" }}>Translation</span>
        <div
          className="flex"
          style={{
            gap: 4,
            padding: 3,
            background: "rgba(184,149,58,0.08)",
            border: "1px solid rgba(184,149,58,0.25)",
            borderRadius: 999,
          }}
        >
          {TRANSLATIONS.map((t) => {
            const active = t.value === translation;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTranslation(t.value)}
                className="transition-colors inline-flex items-center justify-center"
                style={{
                  padding: "0 14px",
                  minHeight: 44,
                  borderRadius: 999,
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  background: active ? "var(--cog-gold)" : "transparent",
                  color: active ? "var(--cog-cream-light, #faf7f2)" : "var(--cog-charcoal)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reference input */}
      <div
        className="relative flex items-center"
        style={{
          background: "white",
          border: "1px solid var(--cog-border)",
          borderRadius: 14,
          padding: "10px 12px",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Psalm 23  ·  John 3:16-17"
          spellCheck={false}
          autoCapitalize="words"
          // A book reference is not prose — stop iOS mangling "Ps" / "Phil" /
          // "Song" into everyday words as the songwriter types.
          autoCorrect="off"
          autoComplete="off"
          enterKeyHint="search"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: "var(--cog-charcoal)",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear reference"
            className="inline-flex items-center justify-center"
            style={{
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              marginRight: -8,
              background: "transparent",
              border: "none",
              color: "var(--cog-warm-gray)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <p style={{ fontSize: 12, color: error ? "#b54a30" : "var(--cog-warm-gray)", margin: 0 }}>
        {statusLine}
      </p>

      {/* Quick chips */}
      {passage && (
        <div className="flex" style={{ gap: 8 }}>
          <QuickChip onClick={selectAll}>All</QuickChip>
          <QuickChip onClick={selectFirst}>First verse</QuickChip>
          <QuickChip onClick={clearAll}>Clear</QuickChip>
        </div>
      )}

      {/* Verse list */}
      {passage && (
        <div
          style={{
            background: "white",
            border: "1px solid var(--cog-border)",
            borderRadius: 14,
            maxHeight: "40dvh",
            overflowY: "auto",
          }}
        >
          {passage.verses.map((v) => {
            const isOn = selected.has(v.verse);
            return (
              <button
                key={v.verse}
                type="button"
                onClick={() => toggleVerse(v.verse)}
                className="w-full text-left transition-colors"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background: isOn ? "rgba(184,149,58,0.06)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--cog-border)",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `1.5px solid ${isOn ? "var(--cog-gold)" : "var(--cog-border)"}`,
                    background: isOn ? "var(--cog-gold)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  {isOn && <Check size={14} color="var(--cog-cream-light, #faf7f2)" strokeWidth={3} />}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: "var(--font-display)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--cog-gold)",
                    minWidth: 18,
                    paddingTop: 3,
                  }}
                >
                  {v.verse}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--cog-charcoal)",
                  }}
                >
                  {v.text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full h-12 rounded-2xl text-base font-semibold transition-opacity"
        style={{
          background: "var(--cog-gold)",
          color: "var(--cog-cream-light, #faf7f2)",
          opacity: canSave ? 1 : 0.5,
          border: "none",
          cursor: canSave ? "pointer" : "not-allowed",
        }}
      >
        Save to take
      </button>

      <button
        type="button"
        onClick={onFallback}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--cog-warm-gray)",
          fontSize: 12,
          textDecoration: "underline",
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        Paste manually instead
      </button>
    </div>
  );
};

const QuickChip = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center justify-center transition-transform active:scale-95"
    style={{
      minHeight: 44,
      padding: "0 16px",
      borderRadius: 999,
      background: "transparent",
      border: "1px solid rgba(184,149,58,0.30)",
      color: "var(--cog-charcoal)",
      fontFamily: "var(--font-body)",
      fontSize: 13,
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

export default ScripturePicker;