interface SongRootCardProps {
  title: string;
}

const SongRootCard = ({ title }: SongRootCardProps) => (
  <section
    aria-label="Root song card"
    style={{
      position: "absolute",
      left: 80,
      top: 48,
      width: 420,
      minHeight: 132,
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      border: "1.5px solid rgba(181,147,90,0.36)",
      boxShadow: "0 10px 28px rgba(28,26,23,0.10)",
      padding: 18,
      boxSizing: "border-box",
      color: "#1A1A1A",
    }}
  >
    <p
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "#B5935A",
      }}
    >
      Root song
    </p>
    <p
      style={{
        margin: "8px 0 6px",
        fontFamily: "var(--font-display)",
        fontSize: 24,
        lineHeight: 1.1,
      }}
    >
      {title}
    </p>
    <p
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 13,
        lineHeight: 1.5,
        color: "#6B6459",
      }}
    >
      Start building the song here. Add a lyric, voice memo, chord idea, story note, or scripture note.
    </p>
  </section>
);

export default SongRootCard;
