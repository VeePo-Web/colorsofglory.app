import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import CreateFounderDialog from "@/components/admin/CreateFounderDialog";
import { money, TableSkeleton } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFounderSummary, adminReferralsRecent } from "@/integrations/cog/admin";
import { supabase } from "@/integrations/supabase/client";

type SortKey = "name" | "referrals" | "payable" | "codes";

export default function FoundersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("payable");

  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["admin", "founder-summary"],
    queryFn: adminFounderSummary,
    staleTime: 30_000,
  });

  // Pull all codes for search-by-code-value
  const { data: codes = [] } = useQuery({
    queryKey: ["admin", "all-founder-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("codes")
        .select("id, value, owner_founder_id, status")
        .eq("kind", "founder");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Pull recent referrals (last 500) to enable founder lookup by referred user id
  const { data: recent = [] } = useQuery({
    queryKey: ["admin", "recent", 500],
    queryFn: () => adminReferralsRecent(500),
    staleTime: 30_000,
  });

  const codesByFounder = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of codes) {
      if (!c.owner_founder_id) continue;
      const arr = m.get(c.owner_founder_id) ?? [];
      arr.push(String(c.value));
      m.set(c.owner_founder_id, arr);
    }
    return m;
  }, [codes]);

  const refUserIdsByFounder = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of recent) {
      if (!r.referrer_founder_id) continue;
      const arr = m.get(r.referrer_founder_id) ?? [];
      arr.push(r.referred_user_id);
      m.set(r.referrer_founder_id, arr);
    }
    return m;
  }, [recent]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = founders.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (!needle) return true;
      const codeMatch = (codesByFounder.get(f.founder_id) ?? []).some((c) => c.toLowerCase().includes(needle));
      const refMatch = (refUserIdsByFounder.get(f.founder_id) ?? []).some((u) => u.toLowerCase().includes(needle));
      return (
        f.display_name.toLowerCase().includes(needle) ||
        f.slug.toLowerCase().includes(needle) ||
        codeMatch ||
        refMatch
      );
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "name": return a.display_name.localeCompare(b.display_name);
        case "referrals": return (b.attributed_users ?? 0) - (a.attributed_users ?? 0);
        case "codes": return (b.code_count ?? 0) - (a.code_count ?? 0);
        case "payable":
        default: return Number(b.payable_cents ?? 0) - Number(a.payable_cents ?? 0);
      }
    });
    return rows;
  }, [founders, q, status, sort, codesByFounder, refUserIdsByFounder]);

  const clear = () => { setQ(""); setStatus("all"); };

  return (
    <AdminShell title="Founders">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cog-muted)] pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, slug, code, or referred user id…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="payable">Sort: payable $</SelectItem>
            <SelectItem value="referrals">Sort: referrals</SelectItem>
            <SelectItem value="codes">Sort: code count</SelectItem>
            <SelectItem value="name">Sort: name A→Z</SelectItem>
          </SelectContent>
        </Select>
        {(q || status !== "all") && (
          <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--cog-muted)]">{filtered.length} of {founders.length}</span>
          <CreateFounderDialog />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Founder</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Codes</th>
              <th className="px-4 py-2 text-right">Referrals</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Payable</th>
              <th className="px-4 py-2 text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <TableSkeleton cols={7} />
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--cog-muted)]">No founders match.</td></tr>
            )}
            {filtered.map((f) => (
              <tr key={f.founder_id} className="border-t border-[var(--cog-border)] hover:bg-[rgba(184,149,58,0.04)]">
                <td className="px-4 py-2">
                  <Link to={`/admin/founders/${f.founder_id}`} className="font-medium hover:underline">
                    {f.display_name}
                  </Link>
                  <div className="text-xs text-[var(--cog-muted)] font-mono">{f.slug}</div>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={f.status === "active" ? "default" : "outline"}>{f.status}</Badge>
                </td>
                <td className="px-4 py-2 text-right font-mono">{f.active_codes}/{f.code_count}</td>
                <td className="px-4 py-2 text-right font-mono">{f.attributed_users}</td>
                <td className="px-4 py-2 text-right font-mono">{money(Number(f.pending_cents))}</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--cog-gold)]">{money(Number(f.payable_cents))}</td>
                <td className="px-4 py-2 text-right font-mono">{money(Number(f.paid_cents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}