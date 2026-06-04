import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import { adminFounderSummary, adminReferralsRecent, adminMonthlyPayouts } from "@/integrations/cog/admin";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function AdminHomePage() {
  const { data: founders = [] } = useQuery({ queryKey: ["admin", "founders"], queryFn: adminFounderSummary });
  const { data: recent = [] } = useQuery({ queryKey: ["admin", "recent"], queryFn: () => adminReferralsRecent(25) });
  const { data: payouts = [] } = useQuery({ queryKey: ["admin", "payouts"], queryFn: () => adminMonthlyPayouts() });

  const totalUsers = founders.reduce((s, f) => s + (f.attributed_users || 0), 0);
  const thisMonthCents = payouts.reduce((s, p) => s + (p.payable_cents || 0), 0);

  return (
    <AdminShell>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Active founders" value={founders.length.toString()} />
        <Stat label="Attributed users" value={totalUsers.toString()} />
        <Stat label="Payable (all months)" value={fmt(thisMonthCents)} />
      </div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cog-warm-gray)] mb-2">Recent referrals</h2>
      <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] divide-y divide-[var(--cog-border)]">
        {recent.length === 0 && <div className="px-4 py-6 text-sm text-[var(--cog-warm-gray)]">No referrals yet.</div>}
        {recent.map((r, i) => (
          <div key={i} className="px-4 py-2 text-sm flex items-center justify-between font-mono">
            <span>{r.code_value ?? "—"} → {r.founder_name ?? "—"}</span>
            <span className="text-[var(--cog-warm-gray)]">{new Date(r.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className="text-2xl font-mono mt-1">{value}</div>
    </div>
  );
}