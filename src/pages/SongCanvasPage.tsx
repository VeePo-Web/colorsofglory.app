import { lazy, Suspense, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useSongTitle } from "@/lib/songContext";

const SongCanvasExperience = lazy(() => import("@/components/canvas/SongCanvasExperience"));

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const CanvasRouteFallback = () => {
  const { id } = useParams<{ id: string }>();
  const songTitle = useSongTitle(id ?? "1");

  return (
    <div
      aria-label="Loading song canvas"
      role="status"
      style={{ minHeight: "100dvh", backgroundColor: "#FAFAF6" }}
    >
      <section aria-label="Song canvas loading summary" style={visuallyHidden}>
        <h1>{songTitle}</h1>
        <p>Everything for this song stays connected here.</p>
      </section>
    </div>
  );
};

const SongCanvasPage = () => (
  <div aria-label="Song whiteboard canvas" style={{ display: "contents" }}>
    <Suspense fallback={<CanvasRouteFallback />}>
      <SongCanvasExperience />
    </Suspense>
  </div>
);

export default SongCanvasPage;
