/**
 * Thin banner showing test-mode (sandbox) state or a config-error notice
 * when the Stripe client token is missing entirely. Mount once at the top
 * of the root layout. Renders null in live mode.
 *
 * Visual styling is intentionally minimal — restyle in Claude's lane to
 * match the COG cream/gold palette if a designed treatment is required.
 */
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-red-300 bg-red-100 px-4 py-2 text-center text-sm text-red-800">
        Production checkout is not configured. Complete Stripe go-live in your
        Lovable project to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
        Test mode — payments here are not real charges.
      </div>
    );
  }
  return null;
}

export default PaymentTestModeBanner;