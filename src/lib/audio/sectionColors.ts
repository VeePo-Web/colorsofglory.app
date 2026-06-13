export interface SectionColor {
  bg: string;
  text: string;
  glow: string;
  chipBg: string;
}

const SECTION_COLORS: Record<string, SectionColor> = {
  verse:        { bg: "#C4913A", text: "#FFFFFF", glow: "rgba(196,145,58,0.40)",  chipBg: "rgba(196,145,58,0.18)" },
  chorus:       { bg: "#E8C44A", text: "#1C1A17", glow: "rgba(232,196,74,0.50)",  chipBg: "rgba(232,196,74,0.20)" },
  bridge:       { bg: "#C4735A", text: "#FFFFFF", glow: "rgba(196,115,90,0.40)",  chipBg: "rgba(196,115,90,0.18)" },
  "pre-chorus": { bg: "#A88040", text: "#FFFFFF", glow: "rgba(168,128,64,0.35)",  chipBg: "rgba(168,128,64,0.16)" },
  hook:         { bg: "#D4905A", text: "#FFFFFF", glow: "rgba(212,144,90,0.40)",  chipBg: "rgba(212,144,90,0.18)" },
  intro:        { bg: "#8090A8", text: "#FFFFFF", glow: "rgba(128,144,168,0.35)", chipBg: "rgba(128,144,168,0.16)" },
  outro:        { bg: "#8090A8", text: "#FFFFFF", glow: "rgba(128,144,168,0.35)", chipBg: "rgba(128,144,168,0.16)" },
  instrumental: { bg: "#7A8C7A", text: "#FFFFFF", glow: "rgba(122,140,122,0.35)", chipBg: "rgba(122,140,122,0.16)" },
  tag:          { bg: "#A06878", text: "#FFFFFF", glow: "rgba(160,104,120,0.35)", chipBg: "rgba(160,104,120,0.16)" },
};

const DEFAULT_COLOR: SectionColor = {
  bg: "#B8953A",
  text: "#FFFFFF",
  glow: "rgba(184,149,58,0.35)",
  chipBg: "rgba(184,149,58,0.16)",
};

/** Returns the color set for a section label, normalizing "Verse 1" → "verse". */
export function getSectionColor(label: string): SectionColor {
  const normalized = label.toLowerCase().replace(/\s+\d+$/, "").trim();
  return SECTION_COLORS[normalized] ?? DEFAULT_COLOR;
}
