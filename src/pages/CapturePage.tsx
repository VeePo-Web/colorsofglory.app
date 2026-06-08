import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CaptureScene from "@/components/capture/CaptureScene";
import { supabase } from "@/integrations/supabase/client";

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

  return <CaptureScene songId={songId} songTitle={songTitle} />;
};

export default CapturePage;