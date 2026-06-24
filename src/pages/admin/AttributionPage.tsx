import { useState } from "react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { PromptDialog } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminAttributionForUser, overrideAttribution, type CurrentAttribution } from "@/integrations/cog/admin";

export default function AttributionPage() {
  const [referredId, setReferredId] = useState("");
  const [current, setCurrent] = useState<CurrentAttribution | null>(null);
  const [looking, setLooking] = useState(false);

  const [newType, setNewType] = useState<"founder" | "user">("founder");
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const lookup = async () => {
    const uid = referredId.trim();
    if (!uid) return;
    setLooking(true);
    setCurrent(null);
    try {
      setCurrent(await adminAttributionForUser(uid));
    } catch (e) {
      toast.error((e as Error).message ?? "Lookup failed");
    } finally {
      setLooking(false);
    }
  };

  const requestOverride = () => {
    if (!referredId.trim() || !newId.trim()) return;
    if (!reason.trim()) { toast.error("A reason is required (it's recorded in the audit log)."); return; }
    setConfirmOpen(true);
  };

  const doOverride = async () => {
    const uid = referredId.trim();
    const rid = newId.trim();
    setSaving(true);
    try {
      await overrideAttribution(uid, newType, rid, reason.trim());
      toast.success("Attribution overridden");
      setNewId(""); setReason("");
      setConfirmOpen(false);
      await lookup();
    } catch (e) {
      toast.error((e as Error).message ?? "Override failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Attribution override">
      <p className="mb-4 max-w-2xl text-sm text-[var(--cog-warm-gray)]">
        Re-attribute a referred user to a different referrer. Use for mis-credited referrals. This changes who earns the
        user's <strong>future</strong> rewards; already-minted rewards are unaffected. Every change is recorded in the audit log.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">Referred user id</span>
          <Input value={referredId} onChange={(e) => setReferredId(e.target.value)} placeholder="user uuid" className="w-[320px] font-mono text-xs" />
        </label>
        <Button onClick={lookup} disabled={looking || !referredId.trim()}>{looking ? "Looking…" : "Look up"}</Button>
      </div>

      {current && (
        <div className="mb-6 rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">Current attribution</div>
          {current.exists ? (
            <ul className="space-y-1">
              <li>Referrer: <strong>{current.referrer_name ?? "—"}</strong> <span className="text-[var(--cog-muted)]">({current.referrer_type})</span></li>
              <li className="font-mono text-xs text-[var(--cog-muted)]">
                {current.referrer_type === "founder" ? current.referrer_founder_id : current.referrer_user_id}
              </li>
              <li className="text-[var(--cog-warm-gray)]">source: {current.source ?? "—"} · locked: {String(current.locked ?? false)}</li>
            </ul>
          ) : (
            <p className="text-[var(--cog-muted)]">No attribution on record for this user.</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
        <div className="mb-3 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">New referrer</div>
        <div className="flex flex-wrap items-end gap-2">
          <select value={newType} onChange={(e) => setNewType(e.target.value as "founder" | "user")} className="h-10 rounded-md border border-[var(--cog-border)] bg-white px-3 text-sm">
            <option value="founder">founder</option>
            <option value="user">user</option>
          </select>
          <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder={newType === "founder" ? "founder id" : "user id"} className="w-[300px] font-mono text-xs" />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason (recorded in audit log)" className="flex-1 min-w-[220px]" />
          <Button disabled={saving || !referredId.trim() || !newId.trim()} onClick={requestOverride}>{saving ? "Saving…" : "Override"}</Button>
        </div>
      </div>

      <PromptDialog
        open={confirmOpen}
        title="Confirm re-attribution"
        description={`Re-attribute this user to ${newType} ${newId.trim().slice(0, 8)}… ? This changes who earns their future rewards. Already-minted rewards are unaffected.`}
        confirmLabel="Re-attribute"
        tone="danger"
        busy={saving}
        onConfirm={doOverride}
        onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}
      />
    </AdminShell>
  );
}
