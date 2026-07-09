import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { PromptDialog, TableSkeleton } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import {
  adminListPayouts,
  adminReferrerLedger,
  adminFraudFlags,
  approvePayout,
  markPayoutPaid,
  markPayoutFailed,
  retryPayout,
  type PayoutRow,
} from "@/integrations/cog/admin";
import { qk } from "@/hooks/queryKeys";

const money = (c: number, cur: string) => `$${(c / 100).toFixed(2)} ${cur?.toUpperCase() ?? ""}`;

const STATUS_TONE: Record<string, string> = {
  draft: "text-[var(--cog-warm-gray)]",
  approved: "text-[var(--cog-gold)]",
  processing: "text-[var(--cog-gold)]",
  paid: "text-[#1b7a43]",
  failed: "text-[#b3261e]",
};

function approveDescription(
  r: PayoutRow,
  payeeByKey: ReadonlyMap<string, { name: string | null; payout_method: string | null }>,
) {
  const kind = r.founder_id ? "founder" : "user";
  const payee = payeeByKey.get(`${kind}:${r.founder_id ?? r.user_id ?? ""}`);
  const who = payee?.name ?? `${kind} ${(r.founder_id ?? r.user_id ?? "").slice(0, 8)}…`;
  const via = payee?.payout_method ? ` via ${payee.payout_method}` : "";
  return `Approve ${money(r.amount_cents, r.currency)} to ${who}${via}? Approval commits this payout for payment — it can only be walked back by marking it failed, with a reason, before it's paid.`;
}

function friendlyError(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  if (m.includes("no_payout_method")) return "Recipient has no payout method on file — they must set one before approval.";
  if (m.includes("recipient_fraud_flagged")) return "Recipient has an open fraud flag — resolve it in Fraud review before approving.";
  if (m.includes("payout_not_draft")) return "That payout is no longer a draft.";
  if (m.includes("payout_not_approved")) return "That payout isn't approved yet.";
  if (m.includes("payout_not_failable")) return "Only approved or processing payouts can be marked failed.";
  if (m.includes("payout_not_failed")) return "Only failed payouts can be retried.";
  if (m.includes("provider_id_required")) return "Enter the provider payout / transfer id so this payment can be reconciled.";
  if (m.includes("reason_required")) return "Add a reason so the failed payout is auditable.";
  return m;
}

export default function PayoutBatchesPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<PayoutRow[]>({
    queryKey: qk.admin.payoutBatches(),
    queryFn: () => adminListPayouts(150),
    staleTime: 15_000,
  });

  // Resolve recipient name + payout method so the operator sees who they're
  // paying (and how) rather than a bare uuid. Reuses the referrer ledger RPC.
  const { data: ledger = [] } = useQuery({
    queryKey: qk.admin.referrerLedger(),
    queryFn: adminReferrerLedger,
    staleTime: 30_000,
  });
  const payeeByKey = new Map(
    ledger.map((l) => [`${l.referrer_type}:${l.referrer_id}`, l] as const),
  );

  // Open fraud flags — an approved payout to a flagged recipient is exactly
  // the mistake this console must make impossible, so surface it on the row.
  const { data: flags = [] } = useQuery({
    queryKey: qk.admin.fraudFlags(true),
    queryFn: () => adminFraudFlags(true, 200),
    staleTime: 15_000,
  });
  const flaggedSubjects = new Set(flags.map((f) => `${f.subject_type}:${f.subject_id}`));

  const [dlg, setDlg] = useState<{ kind: "approve" | "paid" | "failed"; row: PayoutRow } | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.admin.payoutBatches() });
  const run = (fn: () => Promise<unknown>, okMsg: string) =>
    fn().then(() => { toast.success(okMsg); invalidate(); }).catch((e) => toast.error(friendlyError(e)));

  const confirmDialog = (value: string) => {
    if (!dlg || busy) return;
    const { kind, row } = dlg;
    setBusy(true);
    const op =
      kind === "approve" ? approvePayout(row.id)
      : kind === "paid" ? markPayoutPaid(row.id, value)
      : markPayoutFailed(row.id, value);
    op.then(() => { toast.success(kind === "approve" ? "Approved" : kind === "paid" ? "Marked paid" : "Marked failed"); invalidate(); })
      .catch((e) => toast.error(friendlyError(e)))
      .finally(() => { setBusy(false); setDlg(null); });
  };

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
              const flagged =
                (r.founder_id && flaggedSubjects.has(`founder:${r.founder_id}`)) ||
                (payee && flaggedSubjects.has(`user:${payee.recipient_user_id}`)) ||
                (r.user_id && flaggedSubjects.has(`user:${r.user_id}`));
              return (
                <tr key={r.id} className="border-t border-[var(--cog-border)]">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{recipientName}</div>
                    <div className="text-xs text-[var(--cog-muted)]">
                      <span className="uppercase tracking-wider">{kind}</span>
                      {method ? <span> · {method}</span> : <span className="text-[#b3261e]"> · no payout method</span>}
                      {flagged && <span className="text-[#b3261e]"> · ⚠ open fraud flag</span>}
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
                      <Button
                        size="sm"
                        disabled={busy || !!flagged}
                        title={flagged ? "Recipient has an open fraud flag — resolve it in Fraud review first." : undefined}
                        onClick={() => setDlg({ kind: "approve", row: r })}
                      >
                        Approve
                      </Button>
                    )}
                    {r.status === "approved" && (
                      <>
                        <Button size="sm" onClick={() => setDlg({ kind: "paid", row: r })}>Mark paid</Button>
                        <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "failed", row: r })}>Mark failed</Button>
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
        title={dlg?.kind === "approve" ? "Approve payout" : dlg?.kind === "paid" ? "Mark payout paid" : "Mark payout failed"}
        description={dlg?.kind === "approve" ? approveDescription(dlg.row, payeeByKey) : undefined}
        label={dlg?.kind === "approve" ? undefined : dlg?.kind === "paid" ? "Provider payout / transfer id" : "Failure reason"}
        placeholder={dlg?.kind === "paid" ? "e.g. tr_… or PayPal batch id" : "e.g. invalid account"}
        required={dlg?.kind !== "approve"}
        confirmLabel={dlg?.kind === "approve" ? "Approve payout" : dlg?.kind === "paid" ? "Mark paid" : "Mark failed"}
        tone={dlg?.kind === "failed" ? "danger" : "default"}
        busy={busy}
        onConfirm={confirmDialog}
        onOpenChange={(o) => { if (!o) setDlg(null); }}
      />
    </AdminShell>
  );
}
