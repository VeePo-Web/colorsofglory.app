import { useState } from "react";
import { ChevronDown } from "lucide-react";

const COMMON_SECTIONS = [
  "Raw idea",
  "Verse 1",
  "Verse 2",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Outro",
  "Intro",
  "Hook",
];

interface SectionChipProps {
  value: string;
  onChange: (section: string) => void;
  disabled?: boolean;
}

/**
 * SectionChip — "Saving to: Verse 1" chip with a dropdown picker.
 * Can be changed while recording is in progress.
 */
const SectionChip = ({ value, onChange, disabled = false }: SectionChipProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 12px 5px 10px",
          borderRadius: 9999,
          backgroundColor: "rgba(184,149,58,0.12)",
          border: "1px solid rgba(184,149,58,0.28)",
          color: "#8A6E20",
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 600,
          cursor: disabled ? "default" : "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          transition: "background-color 150ms ease",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Section: ${value}. Tap to change.`}
      >
        <span style={{ fontSize: 10, opacity: 0.7 }}>Saving to:</span>
        <span>{value}</span>
        <ChevronDown size={11} strokeWidth={2.5} style={{ opacity: 0.7, transition: "transform 150ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown */}
          <div
            role="listbox"
            aria-label="Choose section"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
              padding: "6px 0",
              minWidth: 160,
              overflow: "hidden",
            }}
          >
            {COMMON_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={s === value}
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: s === value ? 700 : 400,
                  color: s === value ? "#B8953A" : "#1A1A1A",
                  backgroundColor: s === value ? "rgba(184,149,58,0.08)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background-color 100ms ease",
                }}
                onMouseEnter={(e) => { if (s !== value) (e.target as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (s !== value) (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SectionChip;
