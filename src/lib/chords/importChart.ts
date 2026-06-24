/**
 * Import a plain "chords-over-lyrics" chart (the format on Ultimate Guitar and
 * most worship sites — a chord line sitting above a lyric line) and convert it
 * to ChordPro, so the Sheet can render/transpose/perform it like anything else.
 * This removes the biggest import friction: paste any chart and it just works.
 *
 * Pure functions. Heuristic + column-accurate: each chord attaches to the lyric
 * character beneath it. Reuses parseChordToken to recognize real chords.
 */

import { parseChordToken } from "./sheet";
import type { Mode } from "./keys";

const SECTION_WORD =
  "intro|verse|pre[- ]?chorus|chorus|bridge|tag|outro|interlude|refrain|ending|instrumental|hook|coda|vamp";

function isChordToken(tok: string): boolean {
  return /^[A-G]/.test(tok) && parseChordToken(tok, "C") !== null;
}

/** A line that is nothing but chords (the line that sits above a lyric). */
function isChordLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return t.split(/\s+/).every(isChordToken);
}

/** A section header: [Verse 1], "Chorus:", or "Verse 2". Returns the label. */
function matchHeader(line: string): string | null {
  const t = line.trim();
  const bracket = t.match(/^\[(.+)\]$/);
  if (bracket) return bracket[1].trim();
  const colon = t.match(new RegExp(`^((?:${SECTION_WORD})(?:\\s*\\d+)?)\\s*:$`, "i"));
  if (colon) return colon[1].trim();
  const numbered = t.match(new RegExp(`^((?:${SECTION_WORD})\\s+\\d+)$`, "i"));
  if (numbered) return numbered[1].trim();
  return null;
}

/** ChordPro has inline [chord] tokens mid-line (not a whole-line [Header]). */
export function looksLikeChordPro(text: string): boolean {
  return text.split("\n").some((l) => {
    if (!/\[[^\]]+\]/.test(l)) return false;
    return !/^\[[^\]]+\]$/.test(l.trim());
  });
}

/** True when the text is a chords-over-lyrics chart (a chord line over lyrics). */
export function looksLikeChordsOverLyrics(text: string): boolean {
  if (looksLikeChordPro(text)) return false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isChordLine(lines[i])) continue;
    const next = lines[i + 1];
    if (next.trim() === "" || isChordLine(next) || matchHeader(next)) continue;
    return true;
  }
  return false;
}

function mergeChordsIntoLyric(chordLine: string, lyric: string): string {
  const tokens = [...chordLine.matchAll(/\S+/g)].map((m) => ({ tok: m[0], col: m.index ?? 0 }));
  if (lyric.trim() === "") {
    return tokens.map((t) => `[${t.tok}]`).join(" ");
  }
  let out = lyric;
  for (const { tok, col } of tokens.sort((a, b) => b.col - a.col)) {
    const at = Math.min(col, out.length);
    out = out.slice(0, at) + `[${tok}]` + out.slice(at);
  }
  return out;
}

/**
 * Convert a chords-over-lyrics chart to ChordPro. Section headers become
 * {start_of_section: …}; a chord line above a lyric becomes inline chords;
 * a chord line with nothing under it stays a chord-only (instrumental) line.
 */
export function chordsOverLyricsToChordPro(text: string, _key = "C", _mode: Mode = "major"): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === "") {
      out.push("");
      i++;
      continue;
    }
    const header = matchHeader(raw);
    if (header) {
      out.push(`{start_of_section: ${header}}`);
      i++;
      continue;
    }
    if (isChordLine(raw)) {
      const next = i + 1 < lines.length ? lines[i + 1] : "";
      if (next.trim() !== "" && !isChordLine(next) && !matchHeader(next)) {
        out.push(mergeChordsIntoLyric(raw, next));
        i += 2;
      } else {
        out.push(mergeChordsIntoLyric(raw, ""));
        i++;
      }
      continue;
    }
    out.push(raw);
    i++;
  }
  return out.join("\n");
}
