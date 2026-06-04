import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Code = {
  id: string;
  value: string;
  status: string;
};

type AttributedUser = {
  user_id: string;
  attributed_at: string;
};

type RewardEvent = {
  amount_cents: number;
  status: string;
  reward_kind: string;
  created_at: string;
  invoice_external_id?: string;
  referred_user_id?: string;
};

interface FounderByCodePanelProps {
  codes: Code[];
  usersByCode: Map<string, AttributedUser[]>;
  rewardsByUser: Map<string, RewardEvent[]>;
  payableByCode: Map<string, number>;
  selectedCodeId: string;
  onSelect: (id: string) => void;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const copyUserId = (text: string) => {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "gold" }) => (
  <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
    <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
    <div className={`mt-1 font-mono text-2xl font-semibold ${tone === "gold" ? "text-[var(--cog-gold)]" : ""}`}>
      {value}
    </div>
  </div>
);

const FounderByCodePanel = ({
  codes,
  usersByCode,
  rewardsByUser,
  payableByCode,
  selectedCodeId,
  onSelect,
}: FounderByCodePanelProps) => {
  if (codes.length === 0) {
    return <p className="mt-4 text-sm text-[var(--cog-muted)]">This founder has no codes yet.</p>;
  }

  const users = usersByCode.get(selectedCodeId) ?? [];
  const selectedCode = codes.find((c) => c.id === selectedCodeId);

  let pending = 0;
  let payable = 0;
  let paid = 0;
  for (const user of users) {
    for (const reward of rewardsByUser.get(user.user_id) ?? []) {
      if (reward.reward_kind !== "cash") continue;
      if (reward.status === "pending") pending += reward.amount_cents;
      else if (reward.status === "payable") payable += reward.amount_cents;
      else if (reward.status === "paid") paid += reward.amount_cents;
    }
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedCodeId} onValueChange={onSelect}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Pick a code" />
          </SelectTrigger>
          <SelectContent>
            {codes.map((code) => {
              const userCount = usersByCode.get(code.id)?.length ?? 0;
              const codePayable = payableByCode.get(code.id) ?? 0;
              return (
                <SelectItem key={code.id} value={code.id}>
                  <span className="font-mono font-semibold">{code.value}</span>
                  <span className="ml-2 text-[var(--cog-muted)]">
                    {userCount} users / {money(codePayable)} payable
                  </span>
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

      <div className="overflow-hidden rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)]">
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
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--cog-muted)]">
                  No users have signed up with this code yet.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const rewards = (rewardsByUser.get(user.user_id) ?? []).filter((reward) => reward.reward_kind === "cash");
              let userPending = 0;
              let userPayable = 0;
              let userPaid = 0;
              for (const reward of rewards) {
                if (reward.status === "pending") userPending += reward.amount_cents;
                else if (reward.status === "payable") userPayable += reward.amount_cents;
                else if (reward.status === "paid") userPaid += reward.amount_cents;
              }
              const last = rewards.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];

              return (
                <tr key={user.user_id} className="border-t border-[var(--cog-border)] hover:bg-[rgba(184,149,58,0.04)]">
                  <td className="px-4 py-2">
                    <button
                      className="font-mono text-xs hover:underline"
                      onClick={() => copyUserId(user.user_id)}
                      title="Copy user id"
                    >
                      {user.user_id.slice(0, 8)}...{user.user_id.slice(-4)}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--cog-muted)]">
                    {new Date(user.attributed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{rewards.length}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(userPending)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--cog-gold)]">{money(userPayable)}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(userPaid)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--cog-muted)]">
                    {last?.invoice_external_id ?? "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FounderByCodePanel;
