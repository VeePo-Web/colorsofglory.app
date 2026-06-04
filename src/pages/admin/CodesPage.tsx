import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import { adminFounderSummary, adminFounderDetail, adminDeactivateCode } from "@/integrations/cog/admin";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type FlatCode = {
  id: string;
  code: string;
  status: string;
  redemptions: number;
  max_redemptions: number | null;
  expires_at: string | null;
  founder_id: string;
  founder_name: string;
};

export default function CodesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: founders = [] } = useQuery({ queryKey: ["admin", "founders"], queryFn: adminFounderSummary });

  const detailQueries = useQuery({
    queryKey: ["admin", "codes", "all", founders.map((f) => f.founder_id)],
    enabled: founders.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        founders.map(async (f) => {
          const d = (await adminFounderDetail(f.founder_id)) as { codes?: Omit<FlatCode, "founder_id" | "founder_name">[] };
          return (d.codes ?? []).map((c) => ({ ...c, founder_id: f.founder_id, founder_name: f.display_name }));
        }),
      );
      return results.flat() as FlatCode[];
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminDeactivateCode(id),
    onSuccess: () => {
      toast({ title: "Code deactivated" });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rows = useMemo(() => {
    const all = detailQueries.data ?? [];
    if (!filter) return all;
    const f = filter.toLowerCase();
    return all.filter((c) => c.code.toLowerCase().includes(f) || c.founder_name.toLowerCase().includes(f));
  }, [detailQueries.data, filter]);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-xl font-semibold">Codes</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Filter codes…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-56" />
          <CreateCodeDialog />
        </div>
      </div>
      <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Founder</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Redemptions</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detailQueries.isLoading && <TableRow><TableCell colSpan={6} className="text-center text-sm text-[var(--cog-warm-gray)]">Loading…</TableCell></TableRow>}
            {!detailQueries.isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-[var(--cog-warm-gray)]">No codes.</TableCell></TableRow>}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono">{c.code}</TableCell>
                <TableCell><Link to={`/admin/founders/${c.founder_id}`} className="underline">{c.founder_name}</Link></TableCell>
                <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                <TableCell className="text-right font-mono">{c.redemptions}{c.max_redemptions ? `/${c.max_redemptions}` : ""}</TableCell>
                <TableCell className="text-sm font-mono">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  {c.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Deactivate ${c.code}?`)) deactivate.mutate(c.id); }}>
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}