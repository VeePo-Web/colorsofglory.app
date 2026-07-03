import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordSongSurface } from "@/lib/nav/songResume";

/**
 * SongSurfaceTracker — invisible; watches the router and remembers which
 * surface of which song the songwriter was last on, so the catalog's
 * "open" and "pick up where you left off" return them to that exact spot.
 */
const SongSurfaceTracker = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    recordSongSurface(pathname, search);
  }, [pathname, search]);
  return null;
};

export default SongSurfaceTracker;
