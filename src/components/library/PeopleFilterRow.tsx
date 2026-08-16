import type { BandPerson } from "@/lib/library/bandIndex";

interface PeopleFilterRowProps {
  people: BandPerson[];
  /** Selected userIds — multi-select is AND ("songs they share"). */
  selected: string[];
  onToggle: (userId: string) => void;
  onClear: () => void;
}

/**
 * The face row — your people as the library's first filter (THE BAND SHELF).
 * Tap Craig → Craig's songs. Tap Craig and Parker → the songs they wrote
 * together. Horizontal, thumb-scrollable, gold when active. The host
 * calm-gates it: a solo writer never sees this row.
 */
const PeopleFilterRow = ({ people, selected, onToggle, onClear }: PeopleFilterRowProps) => {
  const selectedSet = new Set(selected);
  return (
    <div className="mb-3 -mx-1 overflow-x-auto cog-scroll" role="group" aria-label="Filter songs by person">
      <div className="flex items-center gap-2 px-1" style={{ width: "max-content" }}>
        <button
          onClick={onClear}
          aria-pressed={selected.length === 0}
          className="rounded-full px-3.5 font-semibold transition-transform duration-150 active:scale-95"
          style={{
            minHeight: 44,
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            backgroundColor: selected.length === 0 ? "var(--cog-charcoal)" : "var(--cog-cream-light)",
            color: selected.length === 0 ? "#FFFFFF" : "var(--cog-warm-gray)",
            border: selected.length === 0 ? "1px solid var(--cog-charcoal)" : "1px solid var(--cog-border)",
          }}
        >
          Everyone
        </button>
        {people.map((person) => {
          const active = selectedSet.has(person.userId);
          return (
            <button
              key={person.userId}
              onClick={() => onToggle(person.userId)}
              aria-pressed={active}
              aria-label={`${person.firstName} — ${person.songCount} ${person.songCount === 1 ? "song" : "songs"}${active ? ", filtering" : ""}`}
              className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 transition-transform duration-150 active:scale-95"
              style={{
                minHeight: 44,
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                backgroundColor: active ? "var(--cog-gold-pale)" : "var(--cog-cream-light)",
                color: active ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
                border: active ? "1.5px solid var(--cog-gold)" : "1px solid var(--cog-border)",
              }}
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center rounded-full font-bold text-white"
                style={{ width: 28, height: 28, fontSize: "0.625rem", backgroundColor: person.avatarColor }}
              >
                {person.initials}
              </span>
              {person.firstName}
              <span style={{ color: "var(--cog-muted)", fontWeight: 500 }}>{person.songCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PeopleFilterRow;
