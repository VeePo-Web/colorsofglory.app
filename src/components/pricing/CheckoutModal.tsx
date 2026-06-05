import { X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string
);

interface CheckoutModalProps {
  clientSecret: string;
  onClose: () => void;
}

/**
 * Renders Stripe's EmbeddedCheckout inside a full-screen modal overlay.
 * The `clientSecret` comes from the create-checkout edge function.
 * Stripe handles payment, card entry, and redirects to returnUrl on success.
 */
const CheckoutModal = ({ clientSecret, onClose }: CheckoutModalProps) => (
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

    {/* Stripe embedded checkout */}
    <div
      className="flex-1 overflow-y-auto"
      style={{ maxWidth: 480, width: "100%", margin: "0 auto", backgroundColor: "#FFFFFF" }}
    >
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  </div>
);

export default CheckoutModal;
