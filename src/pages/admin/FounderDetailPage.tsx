import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import { adminFounderDetail, adminDeactivateCode } from "@/integrations/cog/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Detail = {
  founder?: { display_name?: string; slug?: string; status?: string; reward_profile?: unknown; notes?: string | null };
  codes?: Array<{ id: string; code: string; status: string; redemptions: number; max_redemptions: number | null; expires_at: string | null }>;
  attributions?: Array<{ referred_user_id: string; attributed_at: string; code_id: string | null }>;
  reward_events?: Array<{ id: string; cents: number; status: string; created_at: string }>;
};

const fmt = (c: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

export default function FounderDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "founder", id],
    queryFn: () => adminFounderDetail(id) as Promise<Detail>,
    enabled: !!id,
  });

  const deactivate = useMutation({
    mutationFn: (codeId: string) => adminDeactivateCode(codeId),
    onSuccess: () => {
      toast({ title: "Code deactivated" });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <AdminShell><div className="text-sm text-[var(--cog-warm-gray)]">Loading…</div></AdminShell>;
  if (!data?.founder) return <AdminShell><div>Not found. <Link to="/admin/founders" className="underline">Back</Link></div></AdminShell>;

  const f = data.founder;
  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/admin/founders" className="text-xs text-[var(--cog-warm-gray)] hover:underline">← Founders</Link>
          <h1 className="text-xl font-semibold mt-1">{f.display_name} <span className="text-sm text-[var(--cog-warm-gray)] font-mono">({f.slug})</span></h1>
          {f.notes && <p className="text-sm text-[var(--cog-warm-gray)] mt-1">{f.notes}</p>}
        </div>
        <CreateCodeDialog founderId={id} />
      </div>

      <Section title="Codes">
        {(data.codes ?? []).length === 0 && <Empty label="No codes." />}
        {(data.codes ?? []).map((c) => (
          <Row key={c.id}>
            <div className="font-mono">{c.code}</div>
            <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
            <div className="text-sm font-mono text-[var(--cog-warm-gray)]">
              {c.redemptions}{c.max_redemptions ? `/${c.max_redemptions}` : ""} redeemed
            </div>
            <div className="text-sm font-mono text-[var(--cog-warm-gray)]">
              {c.expires_at ? `exp ${new Date(c.expires_at).toLocaleDateString()}` : "no expiry"}
            </div>
            {c.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => {
                if (confirm(`Deactivate code ${c.code}? New redemptions will be blocked.`)) deactivate.mutate(c.id);
              }}>Deactivate</Button>
            )}
          </Row>
        ))}
      </Section>

      <Section title={`Attributed users (${data.attributions?.length ?? 0})`}>
        {(data.attributions ?? []).length === 0 && <Empty label="No referrals yet." />}
        {(data.attributions ?? []).map((a) => (
          <Row key={a.referred_user_id + a.attributed_at}>
            <div className="font-mono text-xs truncate">{a.referred_user_id}</div>
            <div className="text-sm text-[var(--cog-warm-gray)]">{new Date(a.attributed_at).toLocaleString()}</div>
          </Row>
        ))}
      </Section>

      <Section title={`Reward events (${data.reward_events?.length ?? 0})`}>
        {(data.reward_events ?? []).length === 0 && <Empty label="No events." />}
        {(data.reward_events ?? []).map((e) => (
          <Row key={e.id}>
            <Badge variant="secondary">{e.status}</Badge>
            <div className="font-mono">{fmt(e.cents)}</div>
            <div className="text-sm text-[var(--cog-warm-gray)]">{new Date(e.created_at).toLocaleString()}</div>
          </Row>
        ))}
      </Section>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cog-warm-gray)] mb-2">{title}</h2>
      <div className="border border-[var(--cog-border)] rounded-lg bg-[var(--cog-cream-light)] divide-y divide-[var(--cog-border)]">
        {children}
      </div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2 flex items-center gap-4 flex-wrap">{children}</div>;
}
function Empty({ label }: { label: string }) {
  return <div className="px-4 py-6 text-sm text-[var(--cog-warm-gray)]">{label}</div>;
}