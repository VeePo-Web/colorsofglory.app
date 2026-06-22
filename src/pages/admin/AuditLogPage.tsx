import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchAuditLogs, type AuditSearchFilters, type AuditLogRow } from "@/integrations/cog/admin";

const PAGE = 50;

export default function AuditLogPage() {
  const [draft, setDraft] = useState({ action: "", entity_type: "", invoice_id: "" });
  const [filters, setFilters] = useState<AuditSearchFilters>({});
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit", filters, offset],
    queryFn: () => searchAuditLogs({ ...filters, limit: PAGE, offset }),
    staleTime: 15_000,
  });

  const apply = () => {
    const f: AuditSearchFilters = {};
    if (draft.action.trim()) f.action = draft.action.trim();
    if (draft.entity_type.trim()) f.entity_type = draft.entity_type.trim();
    if (draft.invoice_id.trim()) f.invoice_id = draft.invoice_id.trim();
    setOffset(0);
    setFilters(f);
  };

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <AdminShell title="Audit log">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Action" value={draft.action} onChange={(v) => setDraft({ ...draft, action: v })} placeholder="e.g. approve_payout" />
        <Field label="Entity type" value={draft.entity_type} onChange={(v) => setDraft({ ...draft, entity_type: v })} placeholder="payout · founder · invoice" />
        <Field label="Invoice id" value={draft.invoice_id} onChange={(v) => setDraft({ ...draft, invoice_id: v })} placeholder="in_…" />
        <Button onClick={apply}>Search</Button>
        {(filters.action || filters.entity_type || filters.invoice_id) && (
          <Button variant="outline" onClick={() => { setDraft({ action: "", entity_type: "", invoice_id: "" }); setFilters({}); setOffset(0); }}>Clear</Button>
        )}
        <span className="ml-auto text-xs text-[var(--cog-muted)]">{total} event{total === 1 ? "" : "s"}</span>
      </div>

      {error ? (
        <p className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-6 text-sm text-[var(--cog-warm-gray)]">
          Couldn't load audit log. {(error as Error).message}
        </p>
      ) : (
        <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">Actor</th>
                <th className="px-4 py-2 text-left">Reason</th>
                <th className="px-4 py-2 text-left">Change</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--cog-muted)]">Loading…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--cog-muted)]">No matching events.</td></tr>
              )}
              {rows.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Prev</Button>
        <span className="text-xs text-[var(--cog-muted)]">{offset + 1}–{offset + rows.length} of {total}</span>
        <Button variant="outline" disabled={!data?.has_more} onClick={() => setOffset(offset + PAGE)}>Next →</Button>
      </div>
    </AdminShell>
  );
}

function Row({ r }: { r: AuditLogRow }) {
  const [open, setOpen] = useState(false);
  const hasChange = r.before != null || r.after != null;
  return (
    <>
      <tr className="border-t border-[var(--cog-border)] align-top">
        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
        <td className="px-4 py-2 font-mono">{r.action}</td>
        <td className="px-4 py-2 text-xs">{r.entity_type ?? "—"}{r.entity_id ? <span className="text-[var(--cog-muted)]"> {r.entity_id.slice(0, 8)}…</span> : null}</td>
        <td className="px-4 py-2 font-mono text-xs text-[var(--cog-muted)]">{r.actor_user_id ? `${r.actor_user_id.slice(0, 8)}…` : "system"}</td>
        <td className="px-4 py-2 max-w-[220px] break-words text-xs">{r.reason ?? r.reversed_reason ?? "—"}</td>
        <td className="px-4 py-2">
          {hasChange ? (
            <button className="text-xs text-[var(--cog-gold)] hover:underline" onClick={() => setOpen((o) => !o)}>{open ? "hide" : "view"}</button>
          ) : <span className="text-[var(--cog-muted)] text-xs">—</span>}
        </td>
      </tr>
      {open && hasChange && (
        <tr className="bg-[var(--cog-cream)]">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Json label="before" value={r.before} />
              <Json label="after" value={r.after} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <pre className="overflow-x-auto rounded-md border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-3 text-xs">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-[200px]" />
    </label>
  );
}
