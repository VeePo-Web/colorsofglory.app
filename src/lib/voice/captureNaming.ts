/**
 * A warm, recognizable default name for a freshly captured idea.
 *
 * The world-class capture research is explicit: a default name should "sound like
 * songwriting, not meetings," and a time fallback aids rediscovery. So a take is
 * named for the moment it was caught — "Late-night idea · 11:42 PM" — not
 * "Voice Memo 3." The songwriter renames it in review whenever they like; this is
 * only a name good enough to recognize the spark at a glance.
 *
 * `now` is injectable so the naming is deterministically testable.
 */
export function defaultCaptureName(now: Date = new Date()): string {
  const h = now.getHours();
  const partOfDay =
    h >= 5 && h < 12
      ? "Morning"
      : h >= 12 && h < 17
        ? "Afternoon"
        : h >= 17 && h < 21
          ? "Evening"
          : "Late-night";
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${partOfDay} idea · ${time}`;
}
