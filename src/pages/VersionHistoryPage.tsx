import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const VersionHistoryPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <header
        className="flex items-center gap-3 px-5 pb-3 flex-shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button
          type="button"
          onClick={() => navigate(`/songs/${id}`)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)" }}
          aria-label="Back to song"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
        <h1
          className="font-bold"
          style={{
            fontSize: 17,
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)",
          }}
        >
          Version History
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <p
          className="text-center"
          style={{ color: "var(--cog-warm-gray)", fontSize: 15, lineHeight: 1.6 }}
        >
          Version history is coming soon. Every snapshot of your song will live here.
        </p>
      </main>
    </div>
  );
};

export default VersionHistoryPage;
