import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { adminFounderDetail } from "@/integrations/cog/admin";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

type Detail = {
  founder: { id: string; display_name: string; slug: string; status: string; reward_profile: { first6_cents: number; ongoing_cents: number; first6_months?: number }; notes?: string };
  codes: { id: string; value: string; status: string; redemption_count: number; max_redemptions: number | null; expires_at: string | null; created_at: string }[];
  attributed_users: { user_id: string; attributed_at: string; code_id: string | null }[];
  reward_events: { id: string; amount_cents: number; status: string; reward_kind: string; created_at: string; invoice_external_id?: string; referred_user_id?: string }[];
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
  const [tab, setTab] = useState("codes");
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");

  const usersByCode = useMemo(() => {
    const m = new Map<string, Detail["attributed_users"]>();
    for (const u of data.attributed_users) {
      if (!u.code_id) continue;
      const arr = m.get(u.code_id) ?? [];
      arr.push(u);
      m.set(u.code_id, arr);
    }
    return m;
  }, [data.attributed_users]);

  const rewardsByUser = useMemo(() => {
    const m = new Map<string, Detail["reward_events"]>();
    for (const r of data.reward_events) {
      if (!r.referred_user_id) continue;
      const arr = m.get(r.referred_user_id) ?? [];
      arr.push(r);
      m.set(r.referred_user_id, arr);
    }
    return m;
  }, [data.reward_events]);

  const payableByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.codes) {
      const users = usersByCode.get(c.id) ?? [];
      let sum = 0;
      for (const u of users) {
        for (const r of rewardsByUser.get(u.user_id) ?? []) {
          if (r.reward_kind === "cash" && r.status === "payable") sum += r.amount_cents;
        }
      }
      m.set(c.id, sum);
    }
    return m;
  }, [data.codes, usersByCode, rewardsByUser]);

  // Default selection: code with most referrals
  const defaultedCodeId = useMemo(() => {
    if (selectedCodeId) return selectedCodeId;
    const sorted = [...data.codes].sort(
      (a, b) => (usersByCode.get(b.id)?.length ?? 0) - (usersByCode.get(a.id)?.length ?? 0),
    );
    return sorted[0]?.id ?? "";
  }, [selectedCodeId, data.codes, usersByCode]);

  const openCodeDrilldown = (codeId: string) => {
    setSelectedCodeId(codeId);
    setTab("by-code");
  };

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="codes">Codes ({data.codes.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({data.attributed_users.length})</TabsTrigger>
          <TabsTrigger value="rewards">Rewards ({data.reward_events.length})</TabsTrigger>
          <TabsTrigger value="by-code">By code</TabsTrigger>
        </TabsList>

        <TabsContent value="codes">
          <div className="mb-3"><CreateCodeDialog defaultFounderId={f.id} trigger={<Button size="sm">New code for this founder</Button>} /></div>
          <SimpleTable
            head={["Code", "Status", "Used", "Expires", "Created", ""]}
            rows={data.codes.map((c) => [
              <span className="font-mono font-semibold">{c.value}</span>,
              <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>,
              <span className="font-mono">{c.redemption_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</span>,
              c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—",
              new Date(c.created_at).toLocaleDateString(),
              <button
                className="text-xs text-[var(--cog-gold)] hover:underline"
                onClick={() => openCodeDrilldown(c.id)}
              >
                View referrals →
              </button>,
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

        <TabsContent value="by-code">
          <ByCodePanel
            codes={data.codes}
            usersByCode={usersByCode}
            rewardsByUser={rewardsByUser}
            payableByCode={payableByCode}
            selectedCodeId={defaultedCodeId}
            onSelect={setSelectedCodeId}
          />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function ByCodePanel({
  codes,
  usersByCode,
  rewardsByUser,
  payableByCode,
  selectedCodeId,
  onSelect,
}: {
  codes: Detail["codes"];
  usersByCode: Map<string, Detail["attributed_users"]>;
  rewardsByUser: Map<string, Detail["reward_events"]>;
  payableByCode: Map<string, number>;
  selectedCodeId: string;
  onSelect: (id: string) => void;
}) {
  if (codes.length === 0) {
    return <p className="text-sm text-[var(--cog-muted)] mt-4">This founder has no codes yet.</p>;
  }

  const users = usersByCode.get(selectedCodeId) ?? [];
  const selectedCode = codes.find((c) => c.id === selectedCodeId);

  let pending = 0, payable = 0, paid = 0;
  for (const u of users) {
    for (const r of rewardsByUser.get(u.user_id) ?? []) {
      if (r.reward_kind !== "cash") continue;
      if (r.status === "pending") pending += r.amount_cents;
      else if (r.status === "payable") payable += r.amount_cents;
      else if (r.status === "paid") paid += r.amount_cents;
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  };

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedCodeId} onValueChange={onSelect}>
          <SelectTrigger className="w-[320px]"><SelectValue placeholder="Pick a code" /></SelectTrigger>
          <SelectContent>
            {codes.map((c) => {
              const n = usersByCode.get(c.id)?.length ?? 0;
              const p = payableByCode.get(c.id) ?? 0;
              return (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono font-semibold">{c.value}</span>
                  <span className="text-[var(--cog-muted)] ml-2">· {n} users · {money(p)} payable</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedCode && (
          <Badge variant={selectedCode.status === "active" ? "default" : "outline"}>{selectedCode.status}</Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Referred users" value={String(users.length)} />
        <Stat label="Pending" value={money(pending)} />
        <Stat label="Payable" value={money(payable)} tone="gold" />
        <Stat label="Paid" value={money(paid)} />
      </div>

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Attributed</th>
              <th className="px-4 py-2 text-right">Events</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Payable</th>
              <th className="px-4 py-2 text-right">Paid</th>
              <th className="px-4 py-2 text-left">Last invoice</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--cog-muted)]">No users have signed up with this code yet.</td></tr>
            )}
            {users.map((u) => {
              const rs = (rewardsByUser.get(u.user_id) ?? []).filter((r) => r.reward_kind === "cash");
              let p = 0, pa = 0, pd = 0;
              for (const r of rs) {
                if (r.status === "pending") p += r.amount_cents;
                else if (r.status === "payable") pa += r.amount_cents;
                else if (r.status === "paid") pd += r.amount_cents;
              }
              const last = rs.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
              return (
                <tr key={u.user_id} className="border-t border-[var(--cog-border)] hover:bg-[rgba(184,149,58,0.04)]">
                  <td className="px-4 py-2">
                    <button
                      className="font-mono text-xs hover:underline"
                      onClick={() => copy(u.user_id)}
                      title="Copy user id"
                    >
                      {u.user_id.slice(0, 8)}…{u.user_id.slice(-4)}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--cog-muted)]">{new Date(u.attributed_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{rs.length}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(p)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--cog-gold)]">{money(pa)}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(pd)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--cog-muted)]">{last?.invoice_external_id ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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