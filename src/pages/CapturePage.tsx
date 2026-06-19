import { lazy, Suspense, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const CaptureScene = lazy(() => import("@/components/capture/CaptureScene"));

const CapturePageFallback = () => (
  <div className="relative min-h-screen bg-[var(--cog-cream)]" role="status" aria-label="Preparing capture">
    <div className="pointer-events-none fixed inset-0 cog-glow" />
    <div className="relative mx-auto flex min-h-screen w-full max-w-[var(--max-w-app)] items-center justify-center px-8">
      <div className="h-28 w-28 rounded-full bg-[rgba(184,149,58,0.18)] shadow-[0_10px_30px_rgba(184,149,58,0.25)]" />
    </div>
  </div>
);

/**
 * Capture Page — Adobe-inspired big-mic scene.
 *
 * Two contexts share the same component:
 *   - `/`           → no songId, captures land in Unfiled.
 *   - `/songs/:id/capture` → bound to the song, captures attach there.
 */
const CapturePage = () => {
  const params = useParams<{ id?: string }>();
  const songId = params.id;
  const [songTitle, setSongTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!songId) {
      setSongTitle(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("songs")
        .select("title")
        .eq("id", songId)
        .maybeSingle();
      if (!cancelled) setSongTitle(data?.title ?? undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  return (
    <Suspense fallback={<CapturePageFallback />}>
      <CaptureScene songId={songId} songTitle={songTitle} />
    </Suspense>
  );
};

export default CapturePage;
