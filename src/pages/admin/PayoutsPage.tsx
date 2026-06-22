import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminMonthlyPayouts } from "@/integrations/cog/admin";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function monthInputToISO(m: string) {
  // m = "2026-06" -> "2026-06-01"
  return m ? `${m}-01` : undefined;
}

export default function PayoutsPage() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "payouts", month],
    queryFn: () => adminMonthlyPayouts(monthInputToISO(month)),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.display_name.toLowerCase().includes(n));
  }, [rows, q]);

  const totalPayable = filtered.reduce((s, r) => s + Number(r.payable_cents), 0);
  const totalPending = filtered.reduce((s, r) => s + Number(r.pending_cents), 0);

  const exportCSV = () => {
    const header = ["founder_id", "display_name", "payable_cents", "pending_cents", "invoice_count"];
    const lines = [header.join(",")].concat(
      filtered.map((r) => [r.founder_id, JSON.stringify(r.display_name), r.payable_cents, r.pending_cents, r.invoice_count].join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payouts-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell title="Monthly payouts">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px]" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by founder name…" className="flex-1 min-w-[220px]" />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--cog-muted)]">Payable {money(totalPayable)} · Pending {money(totalPending)}</span>
          <Link to="/admin/payouts/batches"><Button variant="outline">Batches →</Button></Link>
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Founder</th>
              <th className="px-4 py-2 text-right">Payable</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--cog-muted)]">Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--cog-muted)]">No founders for this month.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.founder_id} className="border-t border-[var(--cog-border)]">
                <td className="px-4 py-2">{r.display_name}</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--cog-gold)]">{money(Number(r.payable_cents))}</td>
                <td className="px-4 py-2 text-right font-mono">{money(Number(r.pending_cents))}</td>
                <td className="px-4 py-2 text-right font-mono">{r.invoice_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}