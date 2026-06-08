/** Canonical 66-book table with aliases, ordered to match standard Protestant canon. */
export type BookEntry = {
  canonical: string;     // "1 Corinthians"
  slug: string;          // url-safe lower form for bible-api.com: "1 corinthians"
  chapters: number;
  aliases: string[];     // normalized lowercase, no punctuation, spaces collapsed
};

/** Normalize a user-typed book token for alias lookup: lowercase, strip dots, collapse spaces. */
export function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export const BOOKS: BookEntry[] = [
  // Old Testament
  { canonical: "Genesis", slug: "genesis", chapters: 50, aliases: ["gen", "ge", "gn", "genesis"] },
  { canonical: "Exodus", slug: "exodus", chapters: 40, aliases: ["ex", "exo", "exod", "exodus"] },
  { canonical: "Leviticus", slug: "leviticus", chapters: 27, aliases: ["lev", "le", "lv", "leviticus"] },
  { canonical: "Numbers", slug: "numbers", chapters: 36, aliases: ["num", "nu", "nm", "nb", "numbers"] },
  { canonical: "Deuteronomy", slug: "deuteronomy", chapters: 34, aliases: ["deut", "dt", "deu", "deuteronomy"] },
  { canonical: "Joshua", slug: "joshua", chapters: 24, aliases: ["josh", "jos", "jsh", "joshua"] },
  { canonical: "Judges", slug: "judges", chapters: 21, aliases: ["judg", "jdg", "jg", "jdgs", "judges"] },
  { canonical: "Ruth", slug: "ruth", chapters: 4, aliases: ["ruth", "rth", "ru"] },
  { canonical: "1 Samuel", slug: "1 samuel", chapters: 31, aliases: ["1 sam", "1sam", "1 sa", "1sa", "i samuel", "first samuel", "1 samuel"] },
  { canonical: "2 Samuel", slug: "2 samuel", chapters: 24, aliases: ["2 sam", "2sam", "2 sa", "2sa", "ii samuel", "second samuel", "2 samuel"] },
  { canonical: "1 Kings", slug: "1 kings", chapters: 22, aliases: ["1 kgs", "1kgs", "1 ki", "1ki", "i kings", "first kings", "1 kings"] },
  { canonical: "2 Kings", slug: "2 kings", chapters: 25, aliases: ["2 kgs", "2kgs", "2 ki", "2ki", "ii kings", "second kings", "2 kings"] },
  { canonical: "1 Chronicles", slug: "1 chronicles", chapters: 29, aliases: ["1 chr", "1chr", "1 ch", "1ch", "i chronicles", "first chronicles", "1 chronicles"] },
  { canonical: "2 Chronicles", slug: "2 chronicles", chapters: 36, aliases: ["2 chr", "2chr", "2 ch", "2ch", "ii chronicles", "second chronicles", "2 chronicles"] },
  { canonical: "Ezra", slug: "ezra", chapters: 10, aliases: ["ezr", "ez", "ezra"] },
  { canonical: "Nehemiah", slug: "nehemiah", chapters: 13, aliases: ["neh", "ne", "nehemiah"] },
  { canonical: "Esther", slug: "esther", chapters: 10, aliases: ["est", "esth", "es", "esther"] },
  { canonical: "Job", slug: "job", chapters: 42, aliases: ["job", "jb"] },
  { canonical: "Psalms", slug: "psalms", chapters: 150, aliases: ["ps", "psa", "psalm", "psalms", "pss", "psm"] },
  { canonical: "Proverbs", slug: "proverbs", chapters: 31, aliases: ["prov", "pro", "pr", "prv", "proverbs"] },
  { canonical: "Ecclesiastes", slug: "ecclesiastes", chapters: 12, aliases: ["eccl", "ecc", "ec", "qoh", "ecclesiastes"] },
  { canonical: "Song of Solomon", slug: "song of solomon", chapters: 8, aliases: ["song", "sos", "so", "cant", "song of songs", "song of solomon"] },
  { canonical: "Isaiah", slug: "isaiah", chapters: 66, aliases: ["isa", "is", "isaiah"] },
  { canonical: "Jeremiah", slug: "jeremiah", chapters: 52, aliases: ["jer", "je", "jr", "jeremiah"] },
  { canonical: "Lamentations", slug: "lamentations", chapters: 5, aliases: ["lam", "la", "lamentations"] },
  { canonical: "Ezekiel", slug: "ezekiel", chapters: 48, aliases: ["ezek", "eze", "ezk", "ezekiel"] },
  { canonical: "Daniel", slug: "daniel", chapters: 12, aliases: ["dan", "da", "dn", "daniel"] },
  { canonical: "Hosea", slug: "hosea", chapters: 14, aliases: ["hos", "ho", "hosea"] },
  { canonical: "Joel", slug: "joel", chapters: 3, aliases: ["joel", "joe", "jl"] },
  { canonical: "Amos", slug: "amos", chapters: 9, aliases: ["amos", "am"] },
  { canonical: "Obadiah", slug: "obadiah", chapters: 1, aliases: ["obad", "oba", "ob", "obadiah"] },
  { canonical: "Jonah", slug: "jonah", chapters: 4, aliases: ["jon", "jnh", "jonah"] },
  { canonical: "Micah", slug: "micah", chapters: 7, aliases: ["mic", "mc", "micah"] },
  { canonical: "Nahum", slug: "nahum", chapters: 3, aliases: ["nah", "na", "nahum"] },
  { canonical: "Habakkuk", slug: "habakkuk", chapters: 3, aliases: ["hab", "hb", "habakkuk", "habakuk"] },
  { canonical: "Zephaniah", slug: "zephaniah", chapters: 3, aliases: ["zeph", "zep", "zp", "zephaniah"] },
  { canonical: "Haggai", slug: "haggai", chapters: 2, aliases: ["hag", "hg", "haggai"] },
  { canonical: "Zechariah", slug: "zechariah", chapters: 14, aliases: ["zech", "zec", "zc", "zechariah"] },
  { canonical: "Malachi", slug: "malachi", chapters: 4, aliases: ["mal", "ml", "malachi"] },
  // New Testament
  { canonical: "Matthew", slug: "matthew", chapters: 28, aliases: ["matt", "mt", "mat", "matthew"] },
  { canonical: "Mark", slug: "mark", chapters: 16, aliases: ["mark", "mrk", "mk", "mr"] },
  { canonical: "Luke", slug: "luke", chapters: 24, aliases: ["luke", "lk", "luk"] },
  { canonical: "John", slug: "john", chapters: 21, aliases: ["john", "jn", "jhn"] },
  { canonical: "Acts", slug: "acts", chapters: 28, aliases: ["acts", "ac", "act"] },
  { canonical: "Romans", slug: "romans", chapters: 16, aliases: ["rom", "ro", "rm", "romans"] },
  { canonical: "1 Corinthians", slug: "1 corinthians", chapters: 16, aliases: ["1 cor", "1cor", "1 co", "1co", "i corinthians", "first corinthians", "1 corinthians"] },
  { canonical: "2 Corinthians", slug: "2 corinthians", chapters: 13, aliases: ["2 cor", "2cor", "2 co", "2co", "ii corinthians", "second corinthians", "2 corinthians"] },
  { canonical: "Galatians", slug: "galatians", chapters: 6, aliases: ["gal", "ga", "galatians"] },
  { canonical: "Ephesians", slug: "ephesians", chapters: 6, aliases: ["eph", "ephes", "ephesians"] },
  { canonical: "Philippians", slug: "philippians", chapters: 4, aliases: ["phil", "php", "pp", "philippians"] },
  { canonical: "Colossians", slug: "colossians", chapters: 4, aliases: ["col", "co", "colossians"] },
  { canonical: "1 Thessalonians", slug: "1 thessalonians", chapters: 5, aliases: ["1 thess", "1thess", "1 th", "1th", "i thessalonians", "first thessalonians", "1 thessalonians"] },
  { canonical: "2 Thessalonians", slug: "2 thessalonians", chapters: 3, aliases: ["2 thess", "2thess", "2 th", "2th", "ii thessalonians", "second thessalonians", "2 thessalonians"] },
  { canonical: "1 Timothy", slug: "1 timothy", chapters: 6, aliases: ["1 tim", "1tim", "1 ti", "1ti", "i timothy", "first timothy", "1 timothy"] },
  { canonical: "2 Timothy", slug: "2 timothy", chapters: 4, aliases: ["2 tim", "2tim", "2 ti", "2ti", "ii timothy", "second timothy", "2 timothy"] },
  { canonical: "Titus", slug: "titus", chapters: 3, aliases: ["titus", "ti"] },
  { canonical: "Philemon", slug: "philemon", chapters: 1, aliases: ["philem", "phm", "pm", "philemon"] },
  { canonical: "Hebrews", slug: "hebrews", chapters: 13, aliases: ["heb", "he", "hebrews"] },
  { canonical: "James", slug: "james", chapters: 5, aliases: ["jas", "jm", "james"] },
  { canonical: "1 Peter", slug: "1 peter", chapters: 5, aliases: ["1 pet", "1pet", "1 pe", "1pe", "i peter", "first peter", "1 peter"] },
  { canonical: "2 Peter", slug: "2 peter", chapters: 3, aliases: ["2 pet", "2pet", "2 pe", "2pe", "ii peter", "second peter", "2 peter"] },
  { canonical: "1 John", slug: "1 john", chapters: 5, aliases: ["1 jn", "1jn", "1 jhn", "i john", "first john", "1 john"] },
  { canonical: "2 John", slug: "2 john", chapters: 1, aliases: ["2 jn", "2jn", "2 jhn", "ii john", "second john", "2 john"] },
  { canonical: "3 John", slug: "3 john", chapters: 1, aliases: ["3 jn", "3jn", "3 jhn", "iii john", "third john", "3 john"] },
  { canonical: "Jude", slug: "jude", chapters: 1, aliases: ["jude", "jud", "jd"] },
  { canonical: "Revelation", slug: "revelation", chapters: 22, aliases: ["rev", "re", "rv", "apoc", "revelation", "revelations"] },
];

const ALIAS_INDEX: Map<string, BookEntry> = (() => {
  const m = new Map<string, BookEntry>();
  for (const b of BOOKS) {
    for (const a of b.aliases) m.set(normalizeToken(a), b);
    m.set(normalizeToken(b.canonical), b);
  }
  return m;
})();

export function findBook(token: string): BookEntry | null {
  return ALIAS_INDEX.get(normalizeToken(token)) ?? null;
}