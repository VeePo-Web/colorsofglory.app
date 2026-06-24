import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { TableSkeleton } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { adminBillingEvents, redriveBillingEvent, type BillingEventRow } from "@/integrations/cog/admin";

const money = (c: number | null, cur: string | null) =>
  c == null ? "—" : `$${(c / 100).toFixed(2)}${cur ? ` ${cur.toUpperCase()}` : ""}`;

const REDRIVABLE = new Set(["invoice_paid", "invoice_refunded", "chargeback_created"]);

export default function WebhookOpsPage() {
  const qc = useQueryClient();
  const [onlyFailed, setOnlyFailed] = useState(true);

  const { data: rows = [], isLoading } = useQuery<BillingEventRow[]>({
    queryKey: ["admin", "billing-events", onlyFailed],
    queryFn: () => adminBillingEvents(100, onlyFailed),
    staleTime: 15_000,
  });

  const redrive = useMutation({
    mutationFn: (id: string) => redriveBillingEvent(id),
    onSuccess: () => {
      toast.success("Event re-driven");
      qc.invalidateQueries({ queryKey: ["admin", "billing-events"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Re-drive failed"),
  });

  return (
    <AdminShell title="Webhook ops">
      <div className="mb-4 flex items-center gap-3">
        <Button variant={onlyFailed ? "default" : "outline"} size="sm" onClick={() => setOnlyFailed(true)}>
          Stuck / failed
        </Button>
        <Button variant={!onlyFailed ? "default" : "outline"} size="sm" onClick={() => setOnlyFailed(false)}>
          All recent
        </Button>
        <span className="ml-auto text-xs text-[var(--cog-muted)]">
          {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">When</th>
              <th className="px-4 py-2 text-left">Kind</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-left">Error</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={6} />}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--cog-muted)]">
                {onlyFailed ? "No stuck events — all clear." : "No events yet."}
              </td></tr>
            )}
            {rows.map((r) => {
              const stuck = !r.processed_at || !!r.processing_error;
              return (
                <tr key={r.id} className="border-t border-[var(--cog-border)] align-top">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono">{r.kind}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(r.amount_cents, r.currency)}</td>
                  <td className="px-4 py-2">
                    <span className={stuck ? "text-[#b3261e]" : "text-[var(--cog-warm-gray)]"}>
                      {r.processed_at ? "processed" : "unprocessed"}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-[280px]">
                    {r.processing_error ? (
                      <span className="font-mono text-xs text-[#b3261e] break-words">{r.processing_error}</span>
                    ) : (
                      <span className="text-[var(--cog-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {stuck && REDRIVABLE.has(r.kind) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={redrive.isPending}
                        onClick={() => redrive.mutate(r.id)}
                      >
                        Re-drive
                      </Button>
                    ) : stuck ? (
                      <span className="text-xs text-[var(--cog-muted)]">re-trigger in Stripe</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--cog-muted)]">
        Re-drive re-runs the idempotent money RPC for invoice-paid / refund / chargeback events. Subscription-plan
        events must be re-sent from the Stripe dashboard (they need a live re-fetch).
      </p>
    </AdminShell>
  );
}
