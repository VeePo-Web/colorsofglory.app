/**
 * Breadcrumb — Drive's "you always know where you are", in COG's voice:
 * `All songs / Worship EP`. The root is always one tap from anywhere; the
 * current room is stated, never a link (you're already in it). One level
 * deep forever (an album holds songs; the shelf holds albums), so this is
 * deliberately a two-crumb component — no arrays, no recursion, no menus.
 */
const Breadcrumb = ({
  root,
  onRoot,
  current,
}: {
  root: string;
  onRoot: () => void;
  current: string;
}) => (
  <nav aria-label="Where you are" className="flex min-w-0 items-center">
    <button
      onClick={onRoot}
      className="shrink-0 text-[0.875rem] font-semibold transition-transform duration-150 active:scale-95"
      style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
      aria-label={`Back to ${root.toLowerCase()}`}
    >
      {root}
    </button>
    <span aria-hidden="true" className="mx-1.5 text-[0.875rem]" style={{ color: "var(--cog-muted)" }}>
      /
    </span>
    <span
      aria-current="location"
      className="min-w-0 truncate text-[0.875rem] font-semibold"
      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
    >
      {current}
    </span>
  </nav>
);

export default Breadcrumb;
