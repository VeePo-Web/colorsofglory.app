import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PromptDialog } from "@/components/admin/AdminUI";
import { pauseFounder, resumeFounder, revokeFounder, editRewardProfile } from "@/integrations/cog/admin";

type RewardProfile = { first6_cents: number; ongoing_cents: number; first6_months?: number };

export default function FounderActions({
  founderId, status, rewardProfile, onChanged,
}: {
  founderId: string;
  status: string;
  rewardProfile: RewardProfile;
  onChanged: () => void;
}) {
  const [action, setAction] = useState<"pause" | "revoke" | null>(null);
  const [busy, setBusy] = useState(false);

  const act = (fn: () => Promise<unknown>, msg: string) =>
    fn().then(() => { toast.success(msg); onChanged(); }).catch((e) => toast.error((e as Error).message ?? "Action failed"));

  const resume = () => act(() => resumeFounder(founderId), "Founder resumed");

  const confirmAction = (reason: string) => {
    if (!action) return;
    setBusy(true);
    const r = reason || undefined;
    const op = action === "pause" ? pauseFounder(founderId, r) : revokeFounder(founderId, r);
    op.then(() => { toast.success(action === "pause" ? "Founder paused" : "Founder revoked"); onChanged(); })
      .catch((e) => toast.error((e as Error).message ?? "Action failed"))
      .finally(() => { setBusy(false); setAction(null); });
  };

  return (
    <div className="flex items-center gap-2">
      {status === "active" && <Button size="sm" variant="outline" onClick={() => setAction("pause")}>Pause</Button>}
      {status === "paused" && <Button size="sm" variant="outline" onClick={resume}>Resume</Button>}
      {status !== "revoked" && <Button size="sm" variant="outline" onClick={() => setAction("revoke")}>Revoke</Button>}
      <RewardProfileDialog founderId={founderId} current={rewardProfile} onChanged={onChanged} />

      <PromptDialog
        open={!!action}
        title={action === "revoke" ? "Revoke founder" : "Pause founder"}
        description={action === "revoke"
          ? "Stops future reward minting for this founder. Existing payable rewards are unaffected."
          : "Pauses reward minting until resumed."}
        label="Reason (optional)"
        placeholder="recorded in the audit log"
        confirmLabel={action === "revoke" ? "Revoke" : "Pause"}
        tone={action === "revoke" ? "danger" : "default"}
        busy={busy}
        onConfirm={confirmAction}
        onOpenChange={(o) => { if (!o) setAction(null); }}
      />
    </div>
  );
}

function RewardProfileDialog({ founderId, current, onChanged }: { founderId: string; current: RewardProfile; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [first6, setFirst6] = useState(String(current.first6_cents ?? 0));
  const [ongoing, setOngoing] = useState(String(current.ongoing_cents ?? 0));
  const [months, setMonths] = useState(String(current.first6_months ?? 6));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const profile = { first6_cents: Number(first6), ongoing_cents: Number(ongoing), first6_months: Number(months) };
    if ([profile.first6_cents, profile.ongoing_cents, profile.first6_months].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error("Values must be non-negative numbers.");
      return;
    }
    setSaving(true);
    try {
      await editRewardProfile(founderId, profile, reason.trim() || undefined);
      toast.success("Reward profile updated");
      onChanged();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Could not update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Edit reward profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reward profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <NumField label="First-months reward (cents)" value={first6} onChange={setFirst6} />
          <NumField label="Ongoing reward (cents)" value={ongoing} onChange={setOngoing} />
          <NumField label="First-months count" value={months} onChange={setMonths} />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">Reason (optional)</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="recorded in the audit log" />
          </label>
          <p className="text-xs text-[var(--cog-muted)]">
            Pays the first-months amount for the first N paid months of each referred user, then the ongoing amount.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</span>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </label>
  );
}
