import { Suspense, lazy, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const CaptureScene = lazy(() => import("@/components/capture/CaptureScene"));

const CaptureSceneFallback = () => (
  <div className="relative min-h-[100dvh] w-full" style={{ background: "var(--cog-cream)" }}>
    <div aria-hidden className="pointer-events-none fixed inset-0 cog-glow" />
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[var(--max-w-app)] flex-col justify-center px-8">
      <p
        className="text-center text-xs font-medium uppercase"
        style={{ color: "var(--cog-muted)", letterSpacing: "0.24em" }}
      >
        Preparing capture
      </p>
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
    <Suspense fallback={<CaptureSceneFallback />}>
      <CaptureScene songId={songId} songTitle={songTitle} />
    </Suspense>
  );
};

export default CapturePage;
