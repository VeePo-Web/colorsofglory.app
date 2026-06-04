import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { adminFounderDetail } from "@/integrations/cog/admin";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

type Detail = {
  founder: { id: string; display_name: string; slug: string; status: string; reward_profile: { first6_cents: number; ongoing_cents: number; first6_months?: number }; notes?: string };
  codes: { id: string; value: string; status: string; redemption_count: number; max_redemptions: number | null; expires_at: string | null; created_at: string }[];
  attributed_users: { user_id: string; attributed_at: string; code_id: string | null }[];
  reward_events: { id: string; amount_cents: number; status: string; reward_kind: string; created_at: string; invoice_external_id?: string }[];
  totals: { pending_cents: number; payable_cents: number; paid_cents: number };
};

export default function FounderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "founder", id],
    queryFn: () => adminFounderDetail(id!) as Promise<Detail>,
    enabled: !!id,
  });

  if (isLoading || !data) {
    return <AdminShell title="Founder"><p className="text-sm text-[var(--cog-muted)]">Loading…</p></AdminShell>;
  }

  const f = data.founder;

  return (
    <AdminShell>
      <div className="mb-2"><Link to="/admin/founders" className="text-sm text-[var(--cog-warm-gray)] hover:underline">← Founders</Link></div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{f.display_name}</h1>
          <p className="text-sm font-mono text-[var(--cog-muted)]">{f.slug}</p>
        </div>
        <Badge>{f.status}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Pending" value={money(data.totals.pending_cents)} />
        <Stat label="Payable" value={money(data.totals.payable_cents)} tone="gold" />
        <Stat label="Paid" value={money(data.totals.paid_cents)} />
      </div>

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes">Codes ({data.codes.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({data.attributed_users.length})</TabsTrigger>
          <TabsTrigger value="rewards">Rewards ({data.reward_events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="codes">
          <div className="mb-3"><CreateCodeDialog defaultFounderId={f.id} trigger={<Button size="sm">New code for this founder</Button>} /></div>
          <SimpleTable
            head={["Code", "Status", "Used", "Expires", "Created"]}
            rows={data.codes.map((c) => [
              <span className="font-mono font-semibold">{c.value}</span>,
              <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>,
              <span className="font-mono">{c.redemption_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</span>,
              c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—",
              new Date(c.created_at).toLocaleDateString(),
            ])}
          />
        </TabsContent>

        <TabsContent value="users">
          <SimpleTable
            head={["User", "When", "Code"]}
            rows={data.attributed_users.map((u) => [
              <span className="font-mono text-xs">{u.user_id}</span>,
              new Date(u.attributed_at).toLocaleString(),
              <span className="font-mono text-xs text-[var(--cog-muted)]">{u.code_id?.slice(0, 8) ?? "—"}</span>,
            ])}
          />
        </TabsContent>

        <TabsContent value="rewards">
          <SimpleTable
            head={["When", "Kind", "Status", "Amount", "Invoice"]}
            rows={data.reward_events.map((r) => [
              new Date(r.created_at).toLocaleString(),
              r.reward_kind,
              <Badge variant="outline">{r.status}</Badge>,
              <span className="font-mono">{money(r.amount_cents)}</span>,
              <span className="font-mono text-xs text-[var(--cog-muted)]">{r.invoice_external_id ?? "—"}</span>,
            ])}
          />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-1 ${tone === "gold" ? "text-[var(--cog-gold)]" : ""}`}>{value}</div>
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-[var(--cog-muted)]">Nothing yet.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--cog-border)]">
              {r.map((cell, j) => <td key={j} className="px-4 py-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}