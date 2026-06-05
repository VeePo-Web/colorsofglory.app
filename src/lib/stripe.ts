// Derive Stripe environment from the publishable token prefix.
// Lovable preview is built in PROD mode but uses the sandbox pk_test_ token,
// so we cannot rely on import.meta.env.PROD.
export type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function getStripeEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  // Default to sandbox so preview / unconfigured builds don't accidentally
  // route to live. The edge function will reject if live secrets are missing.
  return "sandbox";
}

export function hasPaymentsToken(): boolean {
  return Boolean(clientToken);
}