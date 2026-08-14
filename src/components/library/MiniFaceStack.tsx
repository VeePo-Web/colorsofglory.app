export interface MiniFace {
  userId: string;
  name: string;
  avatarColor: string;
  initials: string;
}

/**
 * MiniFaceStack — the Drive "shared" signal on a song card: up to three tiny
 * overlapping faces (+N for the rest). Display-only; the card stays the
 * button. Colors are each person's one hue from the shared identity system.
 */
const MiniFaceStack = ({ people, size = 18 }: { people: MiniFace[]; size?: number }) => {
  if (people.length === 0) return null;
  const visible = people.slice(0, 3);
  const rest = people.length - visible.length;
  const label = people.map((p) => p.name).join(", ");
  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={`With ${label}`}
      title={label}
    >
      {visible.map((p, i) => (
        <span
          key={p.userId}
          aria-hidden="true"
          className="flex items-center justify-center rounded-full font-bold text-white"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.42),
            backgroundColor: p.avatarColor,
            border: "1.5px solid #FFFFFF",
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.3),
            position: "relative",
            zIndex: visible.length - i,
          }}
        >
          {p.initials}
        </span>
      ))}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className="font-semibold"
          style={{
            marginLeft: 3,
            fontSize: Math.round(size * 0.55),
            color: "var(--cog-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
};

export default MiniFaceStack;
