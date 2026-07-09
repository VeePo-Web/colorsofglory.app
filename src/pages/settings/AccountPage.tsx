import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import AvatarColorPicker, { AVATAR_COLORS } from "@/components/settings/AvatarColorPicker";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { updateMyProfile } from "@/lib/settings/settingsApi";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Account / Profile (G2 Step 2) — edit display name + avatar color, view
 * email/phone/referral code. Save is calm and optimistic; the identity
 * refreshes app-wide through useCurrentAccount.refresh().
 */
const AccountPage = () => {
  const { loading, user, profile, refresh } = useCurrentAccount();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate the form once from the loaded profile — later refreshes must not
  // stomp what the user is typing.
  useEffect(() => {
    if (loading || hydrated) return;
    setName(profile?.display_name ?? "");
    setColor(profile?.avatar_color ?? AVATAR_COLORS[0].hex);
    setHydrated(true);
  }, [loading, hydrated, profile]);

  const savedName = profile?.display_name ?? "";
  const savedColor = profile?.avatar_color ?? AVATAR_COLORS[0].hex;
  const dirty =
    hydrated &&
    (name.trim() !== savedName.trim() ||
      (color ?? "").toLowerCase() !== savedColor.toLowerCase());

  const avatarColor = color ?? savedColor;
  const initials = useMemo(
    () => initialsOf(name || savedName || user?.email || "?"),
    [name, savedName, user?.email],
  );

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Your name can't be empty.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateMyProfile({ display_name: trimmed, avatar_color: avatarColor });
      await refresh();
      setNotice("Saved. This is how collaborators see you.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save that. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!profile?.referral_code) return;
    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is still visible to copy by hand.
    }
  };

  const infoRows: Array<{ label: string; value: string | null }> = [
    { label: "Email", value: user?.email ?? null },
    { label: "Phone", value: profile?.phone_e164 ?? null },
  ];

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 48% at 50% 86%, rgba(184,149,58,0.13) 0%, transparent 64%)",
        }}
      />

      <BackHeader label="Settings" to="/settings" />

      <main
        className="relative mx-auto flex w-full flex-col px-6 pb-36 pt-2"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <div className="mb-6 flex justify-center">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="mb-2 text-3xl font-semibold"
          style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.1 }}
        >
          Account
        </h1>
        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
          Who you are in every song room you're part of.
        </p>

        {loading || !hydrated ? (
          <div className="space-y-4" aria-label="Loading account">
            <div className="rounded-2xl" style={{ height: 180, backgroundColor: "rgba(28,26,23,0.05)" }} />
            <div className="rounded-2xl" style={{ height: 120, backgroundColor: "rgba(28,26,23,0.05)" }} />
          </div>
        ) : (
          <>
            {error && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: "rgba(224,84,64,0.08)", color: "#E05440", border: "1px solid rgba(224,84,64,0.20)" }}
                role="alert"
              >
                {error}
              </div>
            )}
            {notice && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: "rgba(83,171,139,0.08)", color: "#3E8F71", border: "1px solid rgba(83,171,139,0.20)" }}
                role="status"
              >
                {notice}
              </div>
            )}

            {/* Identity card — avatar + name */}
            <section
              className="mb-4 rounded-2xl p-5"
              style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
            >
              <div className="mb-5 flex justify-center">
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center rounded-full font-bold text-white"
                  style={{
                    width: 72,
                    height: 72,
                    backgroundColor: avatarColor,
                    fontSize: 24,
                    border: "3px solid #FAFAF6",
                    boxShadow: "0 2px 12px rgba(28,26,23,0.12)",
                  }}
                >
                  {initials}
                </div>
              </div>

              <label
                htmlFor="display-name"
                className="mb-1.5 block text-xs font-semibold uppercase"
                style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.14em" }}
              >
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNotice(null); }}
                maxLength={60}
                autoComplete="name"
                placeholder="Your name"
                className="mb-5 w-full rounded-xl px-4 text-base outline-none transition-colors"
                style={{
                  height: 52,
                  backgroundColor: "rgba(255,255,255,0.7)",
                  border: "1.5px solid var(--cog-border)",
                  color: "var(--cog-charcoal)",
                  fontFamily: "var(--font-body)",
                }}
              />

              <p
                className="mb-2 text-xs font-semibold uppercase"
                style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.14em" }}
              >
                Avatar color
              </p>
              <AvatarColorPicker
                value={avatarColor}
                onChange={(hex) => { setColor(hex); setNotice(null); }}
                disabled={isSaving}
              />
            </section>

            <GoldButton
              onClick={handleSave}
              disabled={!dirty}
              loading={isSaving}
              loadingText="Saving..."
              className="mb-6"
            >
              Save changes
            </GoldButton>

            {/* Read-only identity */}
            <section
              className="mb-4 rounded-2xl px-5 py-1"
              style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
            >
              {infoRows.map((row, idx) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-4"
                  style={{ borderBottom: idx === infoRows.length - 1 ? "none" : "1px solid var(--cog-border)" }}
                >
                  <span className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>{row.label}</span>
                  <span className="truncate text-sm font-medium" style={{ color: row.value ? "var(--cog-charcoal)" : "var(--cog-muted)" }}>
                    {row.value ?? "Not added"}
                  </span>
                </div>
              ))}
            </section>

            {/* Referral code */}
            {profile?.referral_code && (
              <section
                className="rounded-2xl p-5"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
              >
                <p
                  className="mb-1 text-xs font-semibold uppercase"
                  style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.14em" }}
                >
                  Your referral code
                </p>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className="text-xl font-semibold tracking-wide"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                  >
                    {profile.referral_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label={copied ? "Copied" : "Copy referral code"}
                    className="flex items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-all active:scale-95"
                    style={{
                      minHeight: 40,
                      color: "var(--cog-gold)",
                      backgroundColor: "rgba(184,149,58,0.10)",
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--cog-muted)" }}>
                  Share it from Refer &amp; Earn — when a friend joins, you both benefit.
                </p>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav active="settings" />
    </div>
  );
};

export default AccountPage;
