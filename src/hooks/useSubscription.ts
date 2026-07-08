import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyBillingStatus } from "@/integrations/cog/billing";
import type { BillingStatus, PlanId, Subscription } from "@/types";

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
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
  const userId = userQuery.data?.id ?? null;

  const subQuery = useQuery({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async () => getMyBillingStatus(),
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => subQuery.refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "storage_addons", filter: `user_id=eq.${userId}` },
        () => subQuery.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, subQuery]);

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