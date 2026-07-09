import { Suspense, lazy, useEffect, useState } from "react";
import { subscribeOutbox } from "@/lib/voice/captureOutbox";
import { useBillingStatus } from "@/hooks/useAppQueries";
import StorageWarningSheet, { type StorageWarningMode } from "./StorageWarningSheet";

const CheckoutModal = lazy(() => import("@/components/pricing/CheckoutModal"));

/** Session key: the approaching-limit nudge shows at most once per session. */
const NUDGE_SEEN_KEY = "cog:storage-nudge-seen";
/** Other surfaces can request the sheet: window.dispatchEvent(new CustomEvent("cog:storage-warning", { detail: { mode } })). */
export const STORAGE_WARNING_EVENT = "cog:storage-warning";

const APPROACHING_PCT = 80;

/**
 * Always-on owner of the storage-warning moment (G1 · Onboarding 16). Mounted
 * once in the app shell, it decides WHEN the sheet appears; the sheet decides
 * what it says. Triggers:
 *   - "over": an outbox `quota_storage` event — a new upload actually paused
 *     (the take is retained on-device). This is the only over-limit trigger, so
 *     the paywall gates exactly the new action, never reading existing work.
 *   - "approaching": billing snapshot ≥80% used — once per session, calm.
 *   - the `cog:storage-warning` CustomEvent — any surface can ask for it.
 * A Pro add-on purchase opens the shared embedded CheckoutModal in place.
 */
const StorageWarningController = () => {
  const billing = useBillingStatus();
  const status = billing.data ?? null;

  const [openMode, setOpenMode] = useState<StorageWarningMode | null>(null);
  const [addonCheckout, setAddonCheckout] = useState<{ clientSecret: string; label: string } | null>(null);

  // Over-limit: a new upload paused on QUOTA_EXCEEDED_STORAGE.
  useEffect(() => {
    return subscribeOutbox((event) => {
      if (event.type === "failed" && event.reason === "quota_storage") {
        setOpenMode("over");
        void billing.refetch();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Approaching-limit: gentle, once per session, only for a signed-in account
  // with a real limit.
  useEffect(() => {
    if (!status?.authenticated) return;
    const pct = status.storage?.pct_used ?? 0;
    if (pct < APPROACHING_PCT || pct >= 100) return;
    try {
      if (sessionStorage.getItem(NUDGE_SEEN_KEY)) return;
      sessionStorage.setItem(NUDGE_SEEN_KEY, "1");
    } catch {
      return;
    }
    setOpenMode((current) => current ?? "approaching");
  }, [status]);

  // On-demand from any surface.
  useEffect(() => {
    const onRequest = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: StorageWarningMode }>).detail?.mode ?? "approaching";
      setOpenMode(mode);
    };
    window.addEventListener(STORAGE_WARNING_EVENT, onRequest);
    return () => window.removeEventListener(STORAGE_WARNING_EVENT, onRequest);
  }, []);

  return (
    <>
      <StorageWarningSheet
        open={openMode !== null}
        mode={openMode ?? "approaching"}
        status={status}
        onClose={() => setOpenMode(null)}
        onAddonSession={(clientSecret, label) => {
          setOpenMode(null);
          setAddonCheckout({ clientSecret, label });
        }}
      />
      {addonCheckout && (
        <Suspense fallback={<div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(26,26,26,0.80)" }} />}>
          <CheckoutModal
            clientSecret={addonCheckout.clientSecret}
            planName={addonCheckout.label.replace("Add", "Storage add-on ·")}
            onClose={() => setAddonCheckout(null)}
          />
        </Suspense>
      )}
    </>
  );
};

export default StorageWarningController;
