import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/hooks/queryKeys";
import { useRealtimeBilling } from "@/hooks/useRealtime";
import {
  getMyBillingStatus,
  type BillingStatus,
  type PlanId,
  type Subscription,
} from "@/integrations/cog/billing";

export type SubscriptionState = {
  plan: PlanId;
  isPro: boolean;
  isActive: boolean;
  inGracePeriod: boolean;
  subscription: Subscription | null;
  storageLimitBytes: number;
  status: BillingStatus | null;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Reactive subscription state for the signed-in user.
 * Reads `current_plan` + latest subscription row + effective storage limit
 * and re-fetches when the `subscriptions` table changes for this user.
 *
 * Use this anywhere you need to gate UI on plan tier. Server-side
 * enforcement still lives in edge functions (`create-song`, `create-checkout`).
 */
export function useSubscription(): SubscriptionState {
  const userQuery = useQuery({
    queryKey: qk.authUser(),
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
  const userId = userQuery.data?.id ?? null;

  const subQuery = useQuery({
    queryKey: qk.subscription(userId),
    enabled: !!userId,
    queryFn: async () => getMyBillingStatus(),
  });

  // Re-hydrate on a remote plan / storage change. Folded onto the shared
  // realtime→invalidation pattern (Step 8): the channel invalidates
  // qk.subscription(userId) — which this very query observes, so it refetches —
  // plus qk.billing() / qk.storage() for the other account hooks.
  useRealtimeBilling(userId);

  const status = subQuery.data ?? null;
  const sub = status?.subscription ?? null;
  const plan: PlanId = status?.plan ?? "free";
  const subStatus = sub?.status ?? null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const futurePeriod = !periodEnd || periodEnd.getTime() > Date.now();

  const isActive =
    (subStatus === "active" || subStatus === "trialing" || subStatus === "past_due") && futurePeriod;
  const inGracePeriod = subStatus === "canceled" && !!periodEnd && periodEnd.getTime() > Date.now();
  const isPro = status?.is_pro ?? ((plan === "pro" || plan === "founder_pro") && (isActive || inGracePeriod));

  return {
    plan,
    isPro,
    isActive: isActive || inGracePeriod,
    inGracePeriod,
    subscription: (sub as unknown as Subscription | null),
    storageLimitBytes: status?.storage.limit_bytes ?? 0,
    status,
    isLoading: userQuery.isLoading || subQuery.isLoading,
    refetch: subQuery.refetch,
  };
}