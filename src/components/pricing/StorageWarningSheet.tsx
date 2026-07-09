import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { purchaseStorageAddon, PRICE_IDS, type BillingStatus } from "@/integrations/cog/billing";
import { buildEmbeddedCheckoutReturnUrl, paymentErrorToMessage } from "@/lib/pricing/pricingApi";

export type StorageWarningMode = "approaching" | "over";

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

const ADDONS: Array<{ label: string; priceId: string }> = [
  { label: "Add 25 GB", priceId: PRICE_IDS.storage_25gb_monthly },
  { label: "Add 100 GB", priceId: PRICE_IDS.storage_100gb_monthly },
];

interface StorageWarningSheetProps {
  open: boolean;
  mode: StorageWarningMode;
  status: BillingStatus | null;
  onClose: () => void;
  /** Opens the embedded checkout with an addon session (Pro accounts only). */
  onAddonSession?: (clientSecret: string, label: string) => void;
}

/**
 * The storage warning + paywall moment (Onboarding 16, "Storage Protects
 * Creative Work"). Two calm states:
 *   - approaching (≥80%): a once-per-session nudge — no action is blocked.
 *   - over: shown only when a NEW upload actually paused (the outbox retained
 *     the take). Existing songs and memos stay fully readable and playable;
 *     the sheet offers the one action that lets new ideas keep flowing.
 * Pro accounts are offered storage add-ons (price shown by Stripe — server
 * truth); everyone else is invited to the plans page. Never a nag banner,
 * never a data-loss threat — the copy leads with what is SAFE.
 */
const StorageWarningSheet = ({ open, mode, status, onClose, onAddonSession }: StorageWarningSheetProps) => {
  const navigate = useNavigate();
  const [pendingAddon, setPendingAddon] = useState<string | null>(null);
  const [addonError, setAddonError] = useState<string | null>(null);

  const storage = status?.storage ?? null;
  const used = storage?.used_bytes ?? 0;
  const limit = storage?.limit_bytes ?? 0;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const isPro = status?.is_pro ?? false;
  const over = mode === "over";

  const handleAddon = async (priceId: string, label: string) => {
    setPendingAddon(priceId);
    setAddonError(null);
    try {
      const { clientSecret } = await purchaseStorageAddon(priceId, buildEmbeddedCheckoutReturnUrl());
      onAddonSession?.(clientSecret, label);
    } catch (err) {
      setAddonError(paymentErrorToMessage(err));
    } finally {
      setPendingAddon(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t p-0"
        style={{ backgroundColor: "var(--cog-cream)", maxWidth: "var(--max-w-app)", margin: "0 auto" }}
        aria-describedby={undefined}
      >
        <div className="px-6 pt-6 pb-8">
          {/* Icon */}
          <div
            className="flex items-center justify-center rounded-full mx-auto mb-5"
            style={{
              width: 56,
              height: 56,
              backgroundColor: over ? "rgba(225,94,57,0.10)" : "rgba(184,149,58,0.12)",
              border: `1.5px solid ${over ? "rgba(225,94,57,0.25)" : "rgba(184,149,58,0.25)"}`,
            }}
          >
            <HardDrive
              size={24}
              strokeWidth={1.5}
              style={{ color: over ? "#E15E39" : "var(--cog-gold)" }}
              aria-hidden="true"
            />
          </div>

          <SheetTitle
            className="text-2xl font-semibold text-center mb-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.15 }}
          >
            {over ? "Your storage is full" : "You're running low on space"}
          </SheetTitle>

          <p
            className="text-sm text-center mb-5 leading-relaxed"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            {over
              ? "Every song and memo you've made is safe and playable. New recordings are saved on your device and will sync the moment there's room."
              : "Everything you've captured is safe. A little more room keeps every new idea safe too."}
          </p>

          {/* Usage bar — real server numbers */}
          {limit > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--cog-charcoal)" }}>
                  {formatBytes(used)} of {formatBytes(limit)} used
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: over ? "#E15E39" : "var(--cog-gold)" }}
                >
                  {percent}%
                </span>
              </div>
              <div
                className="w-full rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Storage ${percent} percent used`}
                style={{ height: 10, backgroundColor: "var(--cog-gold-pale)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: over
                      ? "linear-gradient(90deg, var(--cog-gold) 0%, #E15E39 100%)"
                      : "var(--cog-gold)",
                  }}
                />
              </div>
            </div>
          )}

          {addonError && (
            <p className="text-xs text-center mb-3" style={{ color: "#E05440" }} role="alert">
              {addonError}
            </p>
          )}

          {/* Actions: Pro → storage add-on checkout; otherwise → plans */}
          {isPro ? (
            <div className="flex flex-col gap-2.5">
              {ADDONS.map((addon) => (
                <button
                  key={addon.priceId}
                  onClick={() => handleAddon(addon.priceId, addon.label)}
                  disabled={pendingAddon !== null}
                  className="w-full rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-60"
                  style={{
                    minHeight: 52,
                    backgroundColor: "var(--cog-gold)",
                    fontFamily: "var(--font-body)",
                    boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
                  }}
                >
                  {pendingAddon === addon.priceId ? "Opening checkout…" : addon.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                navigate("/upgrade?source=storage");
              }}
              className="w-full rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
              style={{
                minHeight: 52,
                backgroundColor: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
              }}
            >
              See plans with more space
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full text-sm text-center py-3 mt-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            Not now
          </button>

          {/* The promise, always visible */}
          <p
            className="flex items-center justify-center gap-1.5 text-xs mt-3"
            style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
          >
            <ShieldCheck size={13} strokeWidth={1.5} aria-hidden="true" />
            Your existing songs are never deleted or locked.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StorageWarningSheet;
