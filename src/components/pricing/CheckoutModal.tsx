import { X } from "lucide-react";
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

interface CheckoutModalProps {
  clientSecret: string;
  onClose: () => void;
}

/**
 * Renders Stripe's EmbeddedCheckout inside a full-screen modal overlay.
 * The `clientSecret` comes from the create-checkout edge function.
 * Stripe handles payment, card entry, and redirects to returnUrl on success.
 */
const CheckoutModal = ({ clientSecret, onClose }: CheckoutModalProps) => {
  const configError = !stripePromise
    ? "Checkout is missing a Stripe publishable key."
    : !clientSecret
    ? "Checkout needs a fresh session. Close this and try again."
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(26,26,26,0.80)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      {/* Close bar */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{
          backgroundColor: "#FAFAF6",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <p
          className="text-sm font-semibold"
          style={{ color: "#1A1A1A", fontFamily: "var(--font-display)" }}
        >
          Complete your order
        </p>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 36, height: 36, backgroundColor: "rgba(0,0,0,0.06)", color: "#666" }}
          aria-label="Close checkout"
        >
          <X size={16} strokeWidth={2} />
        </button>
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
