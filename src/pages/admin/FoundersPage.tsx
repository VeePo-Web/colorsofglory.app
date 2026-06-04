import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import CreateFounderDialog from "@/components/admin/CreateFounderDialog";
import { adminFounderSummary } from "@/integrations/cog/admin";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fmt = (c: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

export default function FoundersPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "founders"], queryFn: adminFounderSummary });

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Founders</h1>
        <CreateFounderDialog />
      </div>
      <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Codes</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Payable</TableHead>
              <TableHead className="text-right">Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-sm text-[var(--cog-warm-gray)]">Loading…</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-[var(--cog-warm-gray)]">No founders yet.</TableCell></TableRow>}
            {data.map((f) => (
              <TableRow key={f.founder_id}>
                <TableCell><Link className="underline" to={`/admin/founders/${f.founder_id}`}>{f.display_name}</Link></TableCell>
                <TableCell className="font-mono text-xs">{f.slug}</TableCell>
                <TableCell><Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status}</Badge></TableCell>
                <TableCell className="text-right font-mono">{f.active_codes}/{f.code_count}</TableCell>
                <TableCell className="text-right font-mono">{f.attributed_users}</TableCell>
                <TableCell className="text-right font-mono">{fmt(f.payable_cents)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(f.paid_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}