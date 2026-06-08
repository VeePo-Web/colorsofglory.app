import { findBook, type BookEntry } from "./bookTable";

export type ParsedRef = {
  book: string;
  bookSlug: string;
  chapter: number;
  verses?: { start: number; end: number };
  display: string;
};

/**
 * Parse a free-form Bible reference like:
 *   "Psalm 23"
 *   "Ps 23:1"
 *   "John 3:16-17"
 *   "1 Cor 13:4-7"
 *   "Romans 8"
 * Returns null if unparseable. Cross-chapter refs not supported.
 */
export function parseReference(input: string): ParsedRef | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return null;

  const match = trimmed.match(
    /^\s*((?:[1-3]\s*|i{1,3}\s+)?[A-Za-z][A-Za-z. ]*?)\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/i,
  );
  if (!match) return null;

  const [, rawBook, chapterStr, startStr, endStr] = match;
  const book = findBook(rawBook);
  if (!book) return null;

  const chapter = parseInt(chapterStr, 10);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;

  let verses: { start: number; end: number } | undefined;
  if (startStr) {
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : start;
    if (!Number.isFinite(start) || start < 1) return null;
    if (!Number.isFinite(end) || end < start) return null;
    verses = { start, end };
  }

  return {
    book: book.canonical,
    bookSlug: book.slug,
    chapter,
    verses,
    display: formatDisplay(book, chapter, verses),
  };
}

function formatDisplay(book: BookEntry, chapter: number, verses?: { start: number; end: number }): string {
  if (!verses) return `${book.canonical} ${chapter}`;
  if (verses.start === verses.end) return `${book.canonical} ${chapter}:${verses.start}`;
  return `${book.canonical} ${chapter}:${verses.start}-${verses.end}`;
}

/** Build the canonical label for a saved scripture block based on the selected verse numbers. */
export function buildLabel(
  book: string,
  chapter: number,
  selectedVerses: number[],
  totalVerses: number,
  translation: string,
): string {
  const t = translation.toUpperCase();
  if (selectedVerses.length === 0) return `${book} ${chapter} (${t})`;
  if (selectedVerses.length === totalVerses) return `${book} ${chapter} (${t})`;

  const sorted = [...selectedVerses].sort((a, b) => a - b);
  // Detect a single contiguous run.
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (contiguous) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return first === last
      ? `${book} ${chapter}:${first} (${t})`
      : `${book} ${chapter}:${first}-${last} (${t})`;
  }
  return `${book} ${chapter}:${sorted.join(",")} (${t})`;
}