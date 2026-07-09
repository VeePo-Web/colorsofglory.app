import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, Copy } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import { PromptDialog, TableSkeleton } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminDeactivateCode, adminFounderSummary, adminListFounderCodes, type AdminFounderCodeRow } from "@/integrations/cog/admin";
import { buildReferralShareUrl } from "@/integrations/cog/referrals";
import { qk } from "@/hooks/queryKeys";

type CodeRow = AdminFounderCodeRow;

type SortKey = "created" | "usage" | "expires";

export default function CodesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("created");

  const { data: codes = [], isLoading } = useQuery<CodeRow[]>({
    queryKey: qk.admin.allCodesFull(),
    queryFn: adminListFounderCodes,
    staleTime: 30_000,
  });

  const { data: founders = [] } = useQuery({
    queryKey: qk.admin.founderSummary(),
    queryFn: adminFounderSummary,
    staleTime: 30_000,
  });

  const founderNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of founders) m.set(f.founder_id, f.display_name);
    return m;
  }, [founders]);

  const now = Date.now();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = codes.filter((c) => {
      const founderName = (c.owner_founder_id && founderNameById.get(c.owner_founder_id)) || "";
      if (status === "active" && c.status !== "active") return false;
      if (status === "disabled" && c.status !== "disabled") return false;
      if (status === "expired") {
        const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
        if (!expired) return false;
      }
      if (!needle) return true;
      return (
        String(c.value).toLowerCase().includes(needle) ||
        founderName.toLowerCase().includes(needle)
      );
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "usage") return (b.redemption_count ?? 0) - (a.redemption_count ?? 0);
      if (sort === "expires") {
        const av = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const bv = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return av - bv;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [codes, founderNameById, q, status, sort, now]);

  const [deactivateTarget, setDeactivateTarget] = useState<CodeRow | null>(null);
  const deactivate = useMutation({
    mutationFn: (id: string) => adminDeactivateCode(id),
    onSuccess: () => {
      toast.success("Code deactivated");
      setDeactivateTarget(null);
      qc.invalidateQueries({ queryKey: qk.admin.root() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = () => { setQ(""); setStatus("all"); };

  // A founder code exists to be shared — let the operator copy the ready
  // share link in one tap to hand off to the founder.
  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildReferralShareUrl(code));
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };

  return (
    <AdminShell title="Codes">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cog-muted)] pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or founder name…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Sort: newest</SelectItem>
            <SelectItem value="usage">Sort: redemptions</SelectItem>
            <SelectItem value="expires">Sort: expiring soon</SelectItem>
          </SelectContent>
        </Select>
        {(q || status !== "all") && (
          <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--cog-muted)]">{filtered.length} of {codes.length}</span>
          <CreateCodeDialog />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Founder</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Used</th>
              <th className="px-4 py-2 text-left">Expires</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={7} />}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--cog-muted)]">No codes match.</td></tr>
            )}
            {filtered.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
              return (
                <tr key={c.id} className="border-t border-[var(--cog-border)] hover:bg-[rgba(184,149,58,0.04)]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{c.value}</span>
                      <button
                        type="button"
                        onClick={() => copyLink(c.value)}
                        title="Copy share link"
                        aria-label={`Copy share link for ${c.value}`}
                        className="text-[var(--cog-muted)] transition-colors hover:text-[var(--cog-gold)]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">{(c.owner_founder_id && founderNameById.get(c.owner_founder_id)) || "—"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={c.status === "active" && !expired ? "default" : "outline"}>
                      {expired ? "expired" : c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {c.redemption_count ?? 0}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--cog-muted)]">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--cog-muted)]">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    {c.status === "active" && (
                      <Button variant="outline" size="sm" onClick={() => setDeactivateTarget(c)}>
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PromptDialog
        open={!!deactivateTarget}
        title={`Deactivate ${deactivateTarget?.value ?? "code"}?`}
        description="New redemptions stop immediately. Users already attributed through this code keep their referrer, and the deactivation is recorded in the audit log."
        confirmLabel="Deactivate"
        tone="danger"
        busy={deactivate.isPending}
        onConfirm={() => deactivateTarget && deactivate.mutate(deactivateTarget.id)}
        onOpenChange={(o) => { if (!o) setDeactivateTarget(null); }}
      />
    </AdminShell>
  );
}