import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((url: string | URL, init?: RequestInit) => {
      const gatewayUrl = url.toString().replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any }; id: string }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1Signatures.push(v);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));
  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}

// Map a Stripe price lookup_key (e.g. "cog_pro_monthly") to our sub_plan enum.
export function planForLookupKey(lookupKey: string | null | undefined): "free" | "starter" | "pro" | "founder_pro" {
  if (!lookupKey) return "free";
  if (lookupKey.startsWith("cog_storage")) return "free"; // storage addons don't change plan
  // v2 lookup keys (set by payments--batch_create_product)
  if (lookupKey === "starter_monthly") return "starter";
  if (lookupKey === "pro_monthly_referral_50") return "founder_pro";
  if (lookupKey === "pro_monthly") return "pro";
  // Legacy keys
  if (lookupKey.startsWith("cog_founder")) return "founder_pro";
  if (lookupKey.startsWith("cog_pro")) return "pro";
  // Loud-fail on unknown SKUs — silently downgrading a paying user is
  // far worse than a noisy webhook failure that gets retried.
  console.error("planForLookupKey: unknown lookup_key", lookupKey);
  throw new Error(`unknown_lookup_key:${lookupKey}`);
}

// Unit price (cents) for a given plan — used when seeding subscription rows.
export function defaultUnitAmountForPlan(plan: "free" | "starter" | "pro" | "founder_pro"): number {
  if (plan === "starter") return 500;
  if (plan === "pro") return 10000;
  if (plan === "founder_pro") return 4900;
  return 0;
}

// True if the lookup_key denotes a storage add-on subscription rather
// than the primary Pro / Founder Pro plan.
export function isStorageLookupKey(lookupKey: string | null | undefined): boolean {
  return !!lookupKey && lookupKey.startsWith("cog_storage");
}

const GIB = 1024 * 1024 * 1024;

// Bytes granted by a storage-addon lookup_key. Returns 0 for non-storage keys.
export function bytesForStorageLookupKey(lookupKey: string | null | undefined): number {
  if (!lookupKey) return 0;
  if (lookupKey.startsWith("cog_storage_25gb")) return 25 * GIB;
  if (lookupKey.startsWith("cog_storage_100gb")) return 100 * GIB;
  if (lookupKey.startsWith("cog_storage_500gb")) return 500 * GIB;
  if (lookupKey.startsWith("cog_storage_1tb")) return 1024 * GIB;
  return 0;
}