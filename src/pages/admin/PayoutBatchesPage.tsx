import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { PromptDialog, TableSkeleton } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import {
  adminListPayouts,
  adminReferrerLedger,
  approvePayout,
  markPayoutPaid,
  markPayoutFailed,
  retryPayout,
  type PayoutRow,
} from "@/integrations/cog/admin";

const money = (c: number, cur: string) => `$${(c / 100).toFixed(2)} ${cur?.toUpperCase() ?? ""}`;

const STATUS_TONE: Record<string, string> = {
  draft: "text-[var(--cog-warm-gray)]",
  approved: "text-[var(--cog-gold)]",
  processing: "text-[var(--cog-gold)]",
  paid: "text-[#1b7a43]",
  failed: "text-[#b3261e]",
};

function friendlyError(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  if (m.includes("no_payout_method")) return "Recipient has no payout method on file — they must set one before approval.";
  if (m.includes("payout_not_draft")) return "That payout is no longer a draft.";
  if (m.includes("payout_not_approved")) return "That payout isn't approved yet.";
  if (m.includes("payout_not_failed")) return "Only failed payouts can be retried.";
  if (m.includes("provider_id_required")) return "Enter the provider payout / transfer id so this payment can be reconciled.";
  if (m.includes("reason_required")) return "Add a reason so the failed payout is auditable.";
  return m;
}

export default function PayoutBatchesPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<PayoutRow[]>({
    queryKey: ["admin", "payout-batches"],
    queryFn: () => adminListPayouts(150),
    staleTime: 15_000,
  });

  // Resolve recipient name + payout method so the operator sees who they're
  // paying (and how) rather than a bare uuid. Reuses the referrer ledger RPC.
  const { data: ledger = [] } = useQuery({
    queryKey: ["admin", "referrer-ledger"],
    queryFn: adminReferrerLedger,
    staleTime: 30_000,
  });
  const payeeByKey = new Map(
    ledger.map((l) => [`${l.referrer_type}:${l.referrer_id}`, l] as const),
  );

  const [dlg, setDlg] = useState<{ kind: "paid" | "failed"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "payout-batches"] });
  const run = (fn: () => Promise<unknown>, okMsg: string) =>
    fn().then(() => { toast.success(okMsg); invalidate(); }).catch((e) => toast.error(friendlyError(e)));

  const confirmDialog = (value: string) => {
    if (!dlg) return;
    const { kind, id } = dlg;
    setBusy(true);
    const op = kind === "paid" ? markPayoutPaid(id, value) : markPayoutFailed(id, value);
    op.then(() => { toast.success(kind === "paid" ? "Marked paid" : "Marked failed"); invalidate(); })
      .catch((e) => toast.error(friendlyError(e)))
      .finally(() => { setBusy(false); setDlg(null); });
  };

  const approve = useMutation({
    mutationFn: (id: string) => approvePayout(id),
    onSuccess: () => { toast.success("Approved"); invalidate(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <AdminShell title="Payout batches">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/admin/payouts" className="text-sm text-[var(--cog-warm-gray)] hover:underline">← Monthly report</Link>
        <span className="ml-auto text-xs text-[var(--cog-muted)]">{rows.length} batches · approval requires a payout method on file</span>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-left">Recipient</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Provider ref</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={6} />}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--cog-muted)]">No payout batches yet.</td></tr>
            )}
            {rows.map((r) => {
              const kind = r.founder_id ? "founder" : "user";
              const payee = payeeByKey.get(`${kind}:${r.founder_id ?? r.user_id ?? ""}`);
              const fallbackId = (r.founder_id ?? r.user_id ?? "").slice(0, 8);
              const recipientName = payee?.name ?? (fallbackId ? `${kind} ${fallbackId}…` : "—");
              const method = payee?.payout_method ?? null;
              return (
                <tr key={r.id} className="border-t border-[var(--cog-border)]">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{recipientName}</div>
                    <div className="text-xs text-[var(--cog-muted)]">
                      <span className="uppercase tracking-wider">{kind}</span>
                      {method ? <span> · {method}</span> : <span className="text-[#b3261e]"> · no payout method</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{money(r.amount_cents, r.currency)}</td>
                  <td className="px-4 py-2">
                    <span className={`font-medium ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</span>
                    {r.status === "failed" && r.failure_reason && (
                      <div className="text-xs text-[#b3261e]">{r.failure_reason}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--cog-muted)]">{r.provider_payout_id ?? "—"}</td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    {r.status === "draft" && (
                      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>Approve</Button>
                    )}
                    {r.status === "approved" && (
                      <>
                        <Button size="sm" onClick={() => setDlg({ kind: "paid", id: r.id })}>Mark paid</Button>
                        <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "failed", id: r.id })}>Mark failed</Button>
                      </>
                    )}
                    {r.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => run(() => retryPayout(r.id), "Reset to draft")}>Retry</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PromptDialog
        open={!!dlg}
        title={dlg?.kind === "paid" ? "Mark payout paid" : "Mark payout failed"}
        label={dlg?.kind === "paid" ? "Provider payout / transfer id" : "Failure reason"}
        placeholder={dlg?.kind === "paid" ? "e.g. tr_… or PayPal batch id" : "e.g. invalid account"}
        required
        confirmLabel={dlg?.kind === "paid" ? "Mark paid" : "Mark failed"}
        tone={dlg?.kind === "failed" ? "danger" : "default"}
        busy={busy}
        onConfirm={confirmDialog}
        onOpenChange={(o) => { if (!o) setDlg(null); }}
      />
    </AdminShell>
  );
}
