import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminOtpStats, adminSetAppSetting, type OtpStats } from "@/integrations/cog/admin";
import { qk } from "@/hooks/queryKeys";

function num(settings: Record<string, unknown>, key: string, fallback: number): number {
  const v = settings?.[key];
  return typeof v === "number" ? v : Number(v ?? fallback) || fallback;
}

export default function AuthSecurityPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<OtpStats>({
    queryKey: qk.admin.otpStats(),
    queryFn: adminOtpStats,
    staleTime: 15_000,
  });

  const s = data?.settings ?? {};
  const ceiling = num(s, "otp_daily_global_ceiling", 500);
  const util = ceiling > 0 ? Math.min(100, Math.round(((data?.sends_24h ?? 0) / ceiling) * 100)) : 0;

  return (
    <AdminShell title="Auth security">
      <p className="mb-4 max-w-2xl text-sm text-[var(--cog-warm-gray)]">
        Phone OTP send activity + toll-fraud rails. A sudden spike, or 24h sends approaching the ceiling, means growth — or
        SMS pumping. Tune the limits below; they take effect immediately via the <code>otp-guard</code> edge function.
      </p>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[88px] rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Sends · 24h" value={String(data.sends_24h)} tone={util >= 80 ? "warn" : undefined} />
            <Stat label="Sends · 1h" value={String(data.sends_1h)} />
            <Stat label="Distinct phones · 24h" value={String(data.distinct_phones_24h)} />
            <Stat label="Distinct IPs · 24h" value={String(data.distinct_ips_24h)} />
          </div>

          {/* Ceiling gauge */}
          <div className="mb-8 rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
              <span>Daily ceiling utilization</span>
              <span>{data.sends_24h} / {ceiling} · {util}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cog-cream-dark)]">
              <div className="h-full rounded-full" style={{ width: `${util}%`, backgroundColor: util >= 80 ? "#b3261e" : "var(--cog-gold)" }} />
            </div>
            {util >= 80 && <p className="mt-2 text-xs text-[#b3261e]">Approaching the circuit breaker. If this is real traffic, raise the ceiling; if not, you may be under attack.</p>}
          </div>

          {/* Tunable limits */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Limits</h2>
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <AllowlistEditor settings={s} onSaved={() => qc.invalidateQueries({ queryKey: qk.admin.otpStats() })} />
            <NumberEditor label="Daily global ceiling" k="otp_daily_global_ceiling" value={ceiling} onSaved={() => qc.invalidateQueries({ queryKey: qk.admin.otpStats() })} />
            <NumberEditor label="Max per phone · 15 min" k="otp_max_per_phone_15m" value={num(s, "otp_max_per_phone_15m", 3)} onSaved={() => qc.invalidateQueries({ queryKey: qk.admin.otpStats() })} />
            <NumberEditor label="Max per phone · 24h" k="otp_max_per_phone_day" value={num(s, "otp_max_per_phone_day", 6)} onSaved={() => qc.invalidateQueries({ queryKey: qk.admin.otpStats() })} />
            <NumberEditor label="Max per IP · 1h" k="otp_max_per_ip_hour" value={num(s, "otp_max_per_ip_hour", 8)} onSaved={() => qc.invalidateQueries({ queryKey: qk.admin.otpStats() })} />
          </div>

          {/* Top phones */}
          <h2 className="text-sm uppercase tracking-wider text-[var(--cog-warm-gray)] mb-3">Top phones · last 24h</h2>
          <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--cog-cream-dark)] text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">
                <tr><th className="px-4 py-2 text-left">Phone</th><th className="px-4 py-2 text-right">Sends</th></tr>
              </thead>
              <tbody>
                {data.top_phones.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-[var(--cog-muted)]">No OTP sends in the last 24h.</td></tr>
                ) : data.top_phones.map((p) => (
                  <tr key={p.phone_e164} className="border-t border-[var(--cog-border)]">
                    <td className="px-4 py-2 font-mono">{p.phone_e164}</td>
                    <td className={`px-4 py-2 text-right font-mono ${p.n >= num(s, "otp_max_per_phone_day", 6) ? "text-[#b3261e]" : ""}`}>{p.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function NumberEditor({ label, k, value, onSaved }: { label: string; k: string; value: number; onSaved: () => void }) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(String(value)); }, [value]);
  const dirty = v !== String(value);
  const save = async () => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { toast.error("Must be a non-negative number."); return; }
    setSaving(true);
    try { await adminSetAppSetting(k, n); toast.success(`${label} updated`); onSaved(); }
    catch (e) { toast.error((e as Error).message ?? "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} className="font-mono w-[140px]" />
        <Button size="sm" disabled={!dirty || saving} onClick={save}>Save</Button>
      </div>
    </div>
  );
}

function AllowlistEditor({ settings, onSaved }: { settings: Record<string, unknown>; onSaved: () => void }) {
  const initial = Array.isArray(settings?.otp_geo_allowlist) ? (settings.otp_geo_allowlist as string[]).join(", ") : "+1";
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(initial); }, [initial]);
  const dirty = v !== initial;
  const save = async () => {
    const arr = v.split(",").map((x) => x.trim()).filter(Boolean);
    if (arr.length === 0) { toast.error("Allowlist can't be empty (would block all SMS)."); return; }
    if (!arr.every((x) => /^\+\d{1,3}$/.test(x))) { toast.error("Use E.164 dial prefixes like +1, +44."); return; }
    setSaving(true);
    try { await adminSetAppSetting("otp_geo_allowlist", arr); toast.success("Geo allowlist updated"); onSaved(); }
    catch (e) { toast.error((e as Error).message ?? "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">Geo allowlist (E.164 prefixes)</div>
      <div className="flex items-center gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="+1, +44" className="font-mono flex-1" />
        <Button size="sm" disabled={!dirty || saving} onClick={save}>Save</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-[var(--cog-border)] bg-[var(--cog-cream-light)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-1 ${tone === "warn" ? "text-[#b3261e]" : ""}`}>{value}</div>
    </div>
  );
}
