import type { ReactNode } from "react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/admin/AdminShell";
import CreateCodeDialog from "@/components/admin/CreateCodeDialog";
import FounderActions from "@/components/admin/FounderActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFounderDetail } from "@/integrations/cog/admin";

const FounderByCodePanel = lazy(() => import("@/components/admin/FounderByCodePanel"));
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Detail = {
  founder: {
    id: string;
    display_name: string;
    slug: string;
    status: string;
    reward_profile: {
      first6_cents: number;
      ongoing_cents: number;
      first6_months?: number;
    };
    notes?: string;
  };
  codes: {
    id: string;
    value: string;
    status: string;
    redemption_count: number;
    max_redemptions: number | null;
    expires_at: string | null;
    created_at: string;
  }[];
  attributed_users: {
    user_id: string;
    attributed_at: string;
    code_id: string | null;
  }[];
  reward_events: {
    id: string;
    amount_cents: number;
    status: string;
    reward_kind: string;
    created_at: string;
    invoice_external_id?: string;
    referred_user_id?: string;
  }[];
  totals: {
    pending_cents: number;
    payable_cents: number;
    paid_cents: number;
  };
};

const EMPTY_CODES: Detail["codes"] = [];
const EMPTY_USERS: Detail["attributed_users"] = [];
const EMPTY_REWARDS: Detail["reward_events"] = [];

export default function FounderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "founder", id],
    queryFn: () => adminFounderDetail(id!) as Promise<Detail>,
    enabled: !!id,
  });

  const [tab, setTab] = useState("codes");
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");
  const codes = data?.codes ?? EMPTY_CODES;
  const attributedUsers = data?.attributed_users ?? EMPTY_USERS;
  const rewardEvents = data?.reward_events ?? EMPTY_REWARDS;

  const usersByCode = useMemo(() => {
    const map = new Map<string, Detail["attributed_users"]>();
    for (const user of attributedUsers) {
      if (!user.code_id) continue;
      const users = map.get(user.code_id) ?? [];
      users.push(user);
      map.set(user.code_id, users);
    }
    return map;
  }, [attributedUsers]);

  const rewardsByUser = useMemo(() => {
    const map = new Map<string, Detail["reward_events"]>();
    for (const reward of rewardEvents) {
      if (!reward.referred_user_id) continue;
      const rewards = map.get(reward.referred_user_id) ?? [];
      rewards.push(reward);
      map.set(reward.referred_user_id, rewards);
    }
    return map;
  }, [rewardEvents]);

  const payableByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const code of codes) {
      let sum = 0;
      for (const user of usersByCode.get(code.id) ?? []) {
        for (const reward of rewardsByUser.get(user.user_id) ?? []) {
          if (reward.reward_kind === "cash" && reward.status === "payable") sum += reward.amount_cents;
        }
      }
      map.set(code.id, sum);
    }
    return map;
  }, [codes, rewardsByUser, usersByCode]);

  const defaultedCodeId = useMemo(() => {
    if (selectedCodeId) return selectedCodeId;
    const sorted = [...codes].sort(
      (a, b) => (usersByCode.get(b.id)?.length ?? 0) - (usersByCode.get(a.id)?.length ?? 0),
    );
    return sorted[0]?.id ?? "";
  }, [codes, selectedCodeId, usersByCode]);

  const openCodeDrilldown = (codeId: string) => {
    setSelectedCodeId(codeId);
    setTab("by-code");
  };

  if (isLoading || !data) {
    return (
      <AdminShell title="Founder">
        <p className="text-sm text-[var(--cog-muted)]">Loading...</p>
      </AdminShell>
    );
  }

  const { founder, totals } = data;

  return (
    <AdminShell>
      <div className="mb-2">
        <Link to="/admin/founders" className="text-sm text-[var(--cog-warm-gray)] hover:underline">
          Back to Founders
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{founder.display_name}</h1>
          <p className="font-mono text-sm text-[var(--cog-muted)]">{founder.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{founder.status}</Badge>
          <FounderActions
            founderId={founder.id}
            status={founder.status}
            rewardProfile={founder.reward_profile}
            onChanged={() => refetch()}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Pending" value={money(totals.pending_cents)} />
        <Stat label="Payable" value={money(totals.payable_cents)} tone="gold" />
        <Stat label="Paid" value={money(totals.paid_cents)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="codes">Codes ({codes.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({attributedUsers.length})</TabsTrigger>
          <TabsTrigger value="rewards">Rewards ({rewardEvents.length})</TabsTrigger>
          <TabsTrigger value="by-code">By code</TabsTrigger>
        </TabsList>

        <TabsContent value="codes">
          <div className="mb-3">
            <CreateCodeDialog
              defaultFounderId={founder.id}
              trigger={<Button size="sm">New code for this founder</Button>}
            />
          </div>
          <SimpleTable
            head={["Code", "Status", "Used", "Referred", "Payable", "Expires", "Created", ""]}
            rows={codes.map((code) => {
              const referred = usersByCode.get(code.id)?.length ?? 0;
              return [
                <span className="font-mono font-semibold">{code.value}</span>,
                <Badge variant={code.status === "active" ? "default" : "outline"}>{code.status}</Badge>,
                <span className="font-mono">
                  {code.redemption_count}
                  {code.max_redemptions ? ` / ${code.max_redemptions}` : ""}
                </span>,
                <span className="font-mono">{referred}</span>,
                <span className="font-mono text-[var(--cog-gold)]">{money(payableByCode.get(code.id) ?? 0)}</span>,
                code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "-",
                new Date(code.created_at).toLocaleDateString(),
                <button className="text-xs text-[var(--cog-gold)] hover:underline" onClick={() => openCodeDrilldown(code.id)}>
                  View referrals
                </button>,
              ];
            })}
          />
        </TabsContent>

        <TabsContent value="users">
          <SimpleTable
            head={["User", "When", "Code"]}
            rows={attributedUsers.map((user) => [
              <span className="font-mono text-xs">{user.user_id}</span>,
              new Date(user.attributed_at).toLocaleString(),
              <span className="font-mono text-xs text-[var(--cog-muted)]">{user.code_id?.slice(0, 8) ?? "-"}</span>,
            ])}
          />
        </TabsContent>

        <TabsContent value="rewards">
          <SimpleTable
            head={["When", "Kind", "Status", "Amount", "Invoice"]}
            rows={rewardEvents.map((reward) => [
              new Date(reward.created_at).toLocaleString(),
              reward.reward_kind,
              <Badge variant="outline">{reward.status}</Badge>,
              <span className="font-mono">{money(reward.amount_cents)}</span>,
              <span className="font-mono text-xs text-[var(--cog-muted)]">{reward.invoice_external_id ?? "-"}</span>,
            ])}
          />
        </TabsContent>

        <TabsContent value="by-code">
          <Suspense fallback={<p className="mt-4 text-sm text-[var(--cog-muted)]">Loading by-code breakdown...</p>}>
            <FounderByCodePanel
              codes={codes}
              usersByCode={usersByCode}
              rewardsByUser={rewardsByUser}
              payableByCode={payableByCode}
              selectedCodeId={defaultedCodeId}
              onSelect={setSelectedCodeId}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${tone === "gold" ? "text-[var(--cog-gold)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
          <tr>
            {head.map((heading) => (
              <th key={heading} className="px-4 py-2 text-left">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-4 py-6 text-center text-[var(--cog-muted)]">
                Nothing yet.
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[var(--cog-border)]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
