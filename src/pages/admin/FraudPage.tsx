import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { PromptDialog, TableSkeleton } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminFraudFlags,
  adminCreateFraudFlag,
  adminResolveFraudFlag,
  type FraudFlag,
} from "@/integrations/cog/admin";
import { qk } from "@/hooks/queryKeys";

const SEVERITY_TONE: Record<string, string> = {
  high: "text-[#b3261e]",
  medium: "text-[var(--cog-gold)]",
  low: "text-[var(--cog-warm-gray)]",
};

export default function FraudPage() {
  const qc = useQueryClient();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [subjectType, setSubjectType] = useState<"user" | "founder">("user");
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("low");

  const { data: rows = [], isLoading } = useQuery<FraudFlag[]>({
    queryKey: qk.admin.fraudFlags(onlyOpen),
    queryFn: () => adminFraudFlags(onlyOpen, 200),
    staleTime: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.admin.fraudFlags() });

  const create = useMutation({
    mutationFn: () => adminCreateFraudFlag({ subject_type: subjectType, subject_id: subjectId.trim(), reason: reason.trim(), severity }),
    onSuccess: () => { toast.success("Flag created — minting now blocked for this subject"); setSubjectId(""); setReason(""); invalidate(); },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Could not create flag"),
  });

  const [resolveId, setResolveId] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminResolveFraudFlag(id, note),
    onSuccess: () => { toast.success("Flag resolved"); setResolveId(null); invalidate(); },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Could not resolve"),
  });

  const canCreate = subjectId.trim().length > 0 && reason.trim().length > 0 && !create.isPending;

  return (
    <AdminShell title="Fraud review">
      {/* Create flag */}
      <div className="mb-6 rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
        <div className="mb-3 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">Flag a subject (blocks reward minting)</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value as "user" | "founder")}
            className="h-10 rounded-md border border-[var(--cog-border)] bg-white px-3 text-sm"
          >
            <option value="user">user</option>
            <option value="founder">founder</option>
          </select>
          <Input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder="subject id (uuid)" className="w-[300px] font-mono text-xs" />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" className="flex-1 min-w-[200px]" />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-10 rounded-md border border-[var(--cog-border)] bg-white px-3 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
          <Button disabled={!canCreate} onClick={() => create.mutate()}>Flag</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Button variant={onlyOpen ? "default" : "outline"} size="sm" onClick={() => setOnlyOpen(true)}>Open</Button>
        <Button variant={!onlyOpen ? "default" : "outline"} size="sm" onClick={() => setOnlyOpen(false)}>All</Button>
        <span className="ml-auto text-xs text-[var(--cog-muted)]">{rows.length} flag{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Severity</th>
              <th className="px-4 py-2 text-left">Reason</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton cols={6} />}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--cog-muted)]">{onlyOpen ? "No open flags — clean." : "No flags."}</td></tr>
            )}
            {rows.map((f) => {
              const open = !f.resolved_at;
              return (
                <tr key={f.id} className="border-t border-[var(--cog-border)] align-top">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.subject_type} {f.subject_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2"><span className={SEVERITY_TONE[f.severity] ?? ""}>{f.severity}</span></td>
                  <td className="px-4 py-2 max-w-[280px] break-words">{f.reason}</td>
                  <td className="px-4 py-2">
                    {open ? <span className="text-[#b3261e]">open</span>
                      : <span className="text-[var(--cog-muted)]">resolved{f.resolution_note ? ` · ${f.resolution_note}` : ""}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {open && (
                      <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => setResolveId(f.id)}>Resolve</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--cog-muted)]">
        An open flag on a user or founder blocks all referral reward minting for that subject until resolved. Self-referrals
        are already blocked at the database level; use this for shared-card / velocity / collusion cases.
      </p>

      <PromptDialog
        open={!!resolveId}
        title="Resolve fraud flag"
        description="Resolving re-enables reward minting for this subject (if no other open flag remains)."
        label="Resolution note (optional)"
        placeholder="e.g. verified legitimate"
        confirmLabel="Resolve"
        busy={resolve.isPending}
        onConfirm={(note) => resolveId && resolve.mutate({ id: resolveId, note: note || undefined })}
        onOpenChange={(o) => { if (!o) setResolveId(null); }}
      />
    </AdminShell>
  );
}
