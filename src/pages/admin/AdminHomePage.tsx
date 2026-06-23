import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { adminFounderSummary, adminReferralsRecent, adminAttentionSummary, type AttentionSummary } from "@/integrations/cog/admin";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminHomePage() {
  const { data: founders = [] } = useQuery({ queryKey: ["admin", "founder-summary"], queryFn: adminFounderSummary, staleTime: 30_000 });
  const { data: recent = [] } = useQuery({ queryKey: ["admin", "recent", 25], queryFn: () => adminReferralsRecent(25), staleTime: 30_000 });
  const { data: attn } = useQuery<AttentionSummary>({ queryKey: ["admin", "attention"], queryFn: adminAttentionSummary, staleTime: 20_000 });

  const active = founders.filter((f) => f.status === "active").length;
  const referrals = founders.reduce((s, f) => s + (f.attributed_users ?? 0), 0);
  const payable = founders.reduce((s, f) => s + Number(f.payable_cents ?? 0), 0);
  const pending = founders.reduce((s, f) => s + Number(f.pending_cents ?? 0), 0);

  return (
    <AdminShell title="Dashboard">
      {attn && (
        <>
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Needs attention</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <AlertCard to="/admin/fraud" label="Open fraud flags" count={attn.open_fraud_flags} />
            <AlertCard to="/admin/referrals" label="Blocked payouts" count={attn.blocked_payout_count} sub={money(attn.blocked_payout_cents)} />
            <AlertCard to="/admin/webhooks" label="Stuck webhooks" count={attn.stuck_webhooks} />
            <AlertCard to="/admin/payouts/batches" label="Draft payouts" count={attn.draft_payouts_count} sub={money(attn.draft_payouts_cents)} tone="neutral" />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Active founders" value={String(active)} />
        <Stat label="Total referrals" value={String(referrals)} />
        <Stat label="Payable" value={money(payable)} tone="gold" />
        <Stat label="Pending" value={money(pending)} />
      </div>

      <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Recent referrals</h2>
      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-[var(--cog-muted)]">No referrals yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Founder</th>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">User</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.referred_user_id + r.created_at} className="border-t border-[var(--cog-border)]">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.founder_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">{r.code_value ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--cog-muted)]">{r.referred_user_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function AlertCard({ to, label, count, sub, tone = "alert" }: { to: string; label: string; count: number; sub?: string; tone?: "alert" | "neutral" }) {
  const active = count > 0;
  const accent = active && tone === "alert" ? "border-[#e7b4b0] bg-[#fbeeec]" : active ? "border-[var(--cog-border-gold)] bg-[var(--cog-cream-light)]" : "border-[var(--cog-border)] bg-[var(--cog-cream-light)]";
  const num = active && tone === "alert" ? "text-[#b3261e]" : active ? "text-[var(--cog-gold)]" : "text-[var(--cog-muted)]";
  return (
    <Link to={to} className={`block rounded-lg border p-4 transition-colors hover:border-[var(--cog-gold)] ${accent}`}>
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-1 ${num}`}>{count}{sub ? <span className="ml-2 text-sm font-normal text-[var(--cog-warm-gray)]">{sub}</span> : null}</div>
    </Link>
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