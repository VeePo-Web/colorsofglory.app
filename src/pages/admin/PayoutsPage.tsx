import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { adminMonthlyPayouts } from "@/integrations/cog/admin";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const fmt = (c: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

export default function PayoutsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "payouts"], queryFn: () => adminMonthlyPayouts() });

  const totalPayable = data.reduce((s, r) => s + (r.payable_cents || 0), 0);

  const exportCsv = () => {
    const header = ["founder_id", "display_name", "payable_cents", "pending_cents", "invoice_count"];
    const lines = [header.join(",")];
    for (const r of data) {
      lines.push([r.founder_id, JSON.stringify(r.display_name), r.payable_cents, r.pending_cents, r.invoice_count].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cog-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Monthly payouts</h1>
          <p className="text-sm text-[var(--cog-warm-gray)]">Total payable: <span className="font-mono">{fmt(totalPayable)}</span></p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={data.length === 0}>Export CSV</Button>
      </div>
      <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Founder</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-sm text-[var(--cog-warm-gray)]">Loading…</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-[var(--cog-warm-gray)]">Nothing payable.</TableCell></TableRow>}
            {data.map((r) => (
              <TableRow key={r.founder_id}>
                <TableCell>{r.display_name}</TableCell>
                <TableCell className="text-right font-mono">{r.invoice_count}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.pending_cents)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.payable_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}