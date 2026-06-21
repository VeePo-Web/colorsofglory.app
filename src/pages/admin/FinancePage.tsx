import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { adminFinanceSummary, type FinanceSummary } from "@/integrations/cog/admin";

const money = (c: number) => `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  founder_pro: "Founder Pro",
};

export default function FinancePage() {
  const { data, isLoading, error } = useQuery<FinanceSummary>({
    queryKey: ["admin", "finance-summary"],
    queryFn: adminFinanceSummary,
    staleTime: 30_000,
  });

  const churnRate =
    data && data.active_subs + data.churned_30d > 0
      ? (data.churned_30d / (data.active_subs + data.churned_30d)) * 100
      : 0;

  return (
    <AdminShell title="Finance">
      {error ? (
        <p className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-6 text-sm text-[var(--cog-warm-gray)]">
          Couldn't load finance data. {(error as Error).message}
        </p>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Revenue */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Recurring revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="MRR" value={money(data.mrr_cents)} tone="gold" />
            <Stat label="Active subscriptions" value={String(data.active_subs)} />
            <Stat label="New (30d)" value={`+${data.new_subs_30d}`} />
            <Stat label="Churn (30d)" value={`${data.churned_30d} · ${churnRate.toFixed(1)}%`} />
          </div>

          {/* Plan breakdown */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">MRR by plan</h2>
          <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
                <tr>
                  <th className="px-4 py-2 text-left">Plan</th>
                  <th className="px-4 py-2 text-right">Subscribers</th>
                  <th className="px-4 py-2 text-right">MRR</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys({ ...data.mrr_by_plan, ...data.subs_by_plan }).length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-6 text-[var(--cog-muted)]">No active paid subscriptions yet.</td></tr>
                ) : (
                  Object.keys({ ...data.mrr_by_plan, ...data.subs_by_plan }).map((plan) => (
                    <tr key={plan} className="border-t border-[var(--cog-border)]">
                      <td className="px-4 py-2">{PLAN_LABEL[plan] ?? plan}</td>
                      <td className="px-4 py-2 text-right font-mono">{data.subs_by_plan[plan] ?? 0}</td>
                      <td className="px-4 py-2 text-right font-mono">{money(data.mrr_by_plan[plan] ?? 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Reward liability — money owed to referrers */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Reward liability (owed to referrers)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Total liability" value={money(data.reward_liability_cents)} tone="gold" />
            <Stat label="Pending (held)" value={money(data.reward_pending_cents)} />
            <Stat label="Payable (matured)" value={money(data.reward_payable_cents)} />
            <Stat label="Payouts outstanding" value={money(data.payouts_outstanding_cents)} />
          </div>

          {/* Payouts + leakage */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Payouts &amp; leakage</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Paid out (30d)" value={money(data.payouts_paid_30d_cents)} />
            <Stat label="Paid out (lifetime)" value={money(data.payouts_paid_lifetime_cents)} />
            <Stat label="Refunds (30d)" value={money(data.refunds_30d_cents)} />
            <Stat label="Chargebacks (30d)" value={money(data.chargebacks_30d_cents)} />
          </div>

          <p className="text-xs text-[var(--cog-muted)]">
            Computed from Stripe-sourced rows (subscriptions, reward_events, payouts, billing_events) as of{" "}
            {new Date(data.generated_at).toLocaleString()}. Reconcile against the Stripe dashboard; investigate any drift.
          </p>
        </>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-1 ${tone === "gold" ? "text-[var(--cog-gold)]" : ""}`}>{value}</div>
    </div>
  );
}
