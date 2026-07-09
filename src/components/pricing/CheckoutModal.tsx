import { useEffect, useRef } from "react";
import { X, BadgeCheck } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

export interface AppliedCodeSummary {
  kind: "founder" | "member_referral";
  /** Ready-to-render line, e.g. "Founder code applied — $49/month". */
  label: string;
}

interface CheckoutModalProps {
  clientSecret: string;
  onClose: () => void;
  /** Plan display name shown in the header, e.g. "Pro". */
  planName?: string;
  /** Price + cadence line, e.g. "$49/month". Server-derived — never hardcode. */
  priceLabel?: string;
  /** The referral/founder code applied to this session, if any. */
  appliedCode?: AppliedCodeSummary | null;
}

/**
 * Renders Stripe's EmbeddedCheckout inside a full-screen modal overlay.
 * The `clientSecret` comes from the create-checkout edge function — the
 * session (and any code discount) is created server-side; this surface only
 * confirms to the songwriter what they're buying. Stripe handles payment,
 * card entry, and redirects to returnUrl (→ /checkout/success) on success.
 * Closing the modal is the cancel path: it returns to the pricing page with
 * every selection intact — never a dead end.
 */
const CheckoutModal = ({
  clientSecret,
  onClose,
  planName,
  priceLabel,
  appliedCode,
}: CheckoutModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const configError = !stripePromise
    ? "Checkout is missing a Stripe publishable key."
    : !clientSecret
    ? "Checkout needs a fresh session. Close this and try again."
    : null;

  // Focus management: move focus into the dialog on open, trap Tab inside it,
  // close on Escape, and lock the page scroll behind the overlay.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const headerLine = planName
    ? `${planName}${priceLabel ? ` · ${priceLabel}` : ""}`
    : "Complete your order";

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(26,26,26,0.80)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={planName ? `Checkout — ${headerLine}` : "Checkout"}
    >
      {/* Close bar — restates plan + price so the songwriter always knows
          exactly what they're paying before the card form. */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundColor: "#FAFAF6",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "#1A1A1A", fontFamily: "var(--font-display)" }}
            >
              {headerLine}
            </p>
            {appliedCode && (
              <p
                className="flex items-center gap-1 text-xs mt-0.5"
                style={{ color: "#3E8F71" }}
                role="status"
              >
                <BadgeCheck size={12} strokeWidth={2} aria-hidden="true" />
                {appliedCode.label}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-all active:scale-90 flex-shrink-0 ml-3"
            style={{ width: 36, height: 36, backgroundColor: "rgba(0,0,0,0.06)", color: "#666" }}
            aria-label="Close checkout and return to plans"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ maxWidth: 480, width: "100%", margin: "0 auto", backgroundColor: "#FFFFFF" }}
      >
        {configError ? (
          <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
            <p
              className="mb-3 text-2xl font-semibold"
              style={{ color: "#1A1A1A", fontFamily: "var(--font-display)" }}
            >
              Checkout is almost ready.
            </p>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: "#666" }}>
              {configError}
            </p>
            <button
              onClick={onClose}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-all active:scale-[0.97]"
              style={{ backgroundColor: "#B5935A" }}
            >
              Back to plans
            </button>
          </div>
        ) : (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
