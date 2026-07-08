import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { money, TableSkeleton } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { adminReferrerLedger, type ReferrerLedgerRow } from "@/integrations/cog/admin";
import { qk } from "@/hooks/queryKeys";

export default function ReferralsPage() {
  const [q, setQ] = useState("");
  const { data: rows = [], isLoading } = useQuery<ReferrerLedgerRow[]>({
    queryKey: qk.admin.referrerLedger(),
    queryFn: adminReferrerLedger,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(
      (r) => (r.name ?? "").toLowerCase().includes(n) || (r.referral_code ?? "").toLowerCase().includes(n) || r.recipient_user_id.includes(n),
    );
  }, [rows, q]);

  const totalPayable = filtered.reduce((s, r) => s + Number(r.payable_cents), 0);
  const totalPending = filtered.reduce((s, r) => s + Number(r.pending_cents), 0);
  const blocked = filtered.filter((r) => Number(r.payable_cents) > 0 && !r.payout_method);
  const blockedOwed = blocked.reduce((s, r) => s + Number(r.payable_cents), 0);

  return (
    <AdminShell title="Referrals & payments">
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Referrers" value={String(filtered.length)} />
        <Stat label="Payable now" value={money(totalPayable)} tone="gold" />
        <Stat label="Pending (held)" value={money(totalPending)} />
        <Stat label="Blocked on payout method" value={`${blocked.length} · ${money(blockedOwed)}`} tone={blocked.length ? "warn" : undefined} />
      </div>

      {blocked.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#e7c8a0] bg-[#fbf1df] px-4 py-3 text-sm text-[#7a531b]">
          {blocked.length} referrer{blocked.length === 1 ? "" : "s"} ha{blocked.length === 1 ? "s" : "ve"} {money(blockedOwed)} payable but <strong>no payout method on file</strong> — they can't be paid until they add one.
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, code, or user id…" className="max-w-[360px]" />
        <span className="ml-auto text-xs text-[var(--cog-muted)]">Sorted by amount owed</span>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Referrer</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Referred</th>
              <th className="px-4 py-2 text-right">Paying</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Payable</th>
              <th className="px-4 py-2 text-right">Paid</th>
              <th className="px-4 py-2 text-left">Payout</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={8} />}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-[var(--cog-muted)]">No referrers yet.</td></tr>
            )}
            {filtered.map((r) => {
              const owedNoMethod = Number(r.payable_cents) > 0 && !r.payout_method;
              const label = r.name || r.referral_code || `${r.recipient_user_id.slice(0, 8)}…`;
              return (
                <tr key={`${r.referrer_type}:${r.referrer_id}`} className="border-t border-[var(--cog-border)]">
                  <td className="px-4 py-2">
                    {r.referrer_type === "founder" ? (
                      <Link to={`/admin/founders/${r.referrer_id}`} className="text-[var(--cog-gold)] hover:underline">{label}</Link>
                    ) : (
                      <span>{label}</span>
                    )}
                    {r.referral_code && <span className="ml-2 font-mono text-xs text-[var(--cog-muted)]">{r.referral_code}</span>}
                  </td>
                  <td className="px-4 py-2 text-[var(--cog-warm-gray)]">{r.referrer_type}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.attributed_count}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.paying_count}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(Number(r.pending_cents))}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--cog-gold)]">{money(Number(r.payable_cents))}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(Number(r.paid_cents))}</td>
                  <td className="px-4 py-2">
                    {r.payout_method ? (
                      <span className="text-[var(--cog-warm-gray)]">{r.payout_method}</span>
                    ) : (
                      <span className={owedNoMethod ? "text-[#b3261e]" : "text-[var(--cog-muted)]"}>{owedNoMethod ? "none — blocked" : "none"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" | "warn" }) {
  const valueTone = tone === "gold" ? "text-[var(--cog-gold)]" : tone === "warn" ? "text-[#b3261e]" : "";
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-1 ${valueTone}`}>{value}</div>
    </div>
  );
}
