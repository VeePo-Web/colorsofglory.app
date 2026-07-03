import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardDrive,
  Gift,
  Crown,
  CreditCard,
  ChevronRight,
  User,
  Bell,
  ShieldCheck,
  Compass,
  LogOut,
} from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { resetTour } from "@/lib/onboarding/tour";

interface SettingsRow {
  id: string;
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  to?: string;
  action?: "signout" | "tour";
  accent?: boolean;
  destructive?: boolean;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useCurrentAccount();

  // Real account identity — never hardcode a person's email.
  const accountSublabel =
    profile?.display_name?.trim() ||
    user?.email ||
    "Manage your account";

  const rows = useMemo<SettingsRow[]>(
    () => [
      { id: "account", icon: User, label: "Account", sublabel: accountSublabel, to: "#" },
      { id: "upgrade", icon: Crown, label: "Upgrade to Pro", sublabel: "More songs, more space, exports", to: "/upgrade", accent: true },
      { id: "billing", icon: CreditCard, label: "Billing", sublabel: "Manage plan, invoices, and cancellation", to: "/settings/billing" },
      { id: "storage", icon: HardDrive, label: "Storage", sublabel: "Manage your space", to: "/settings/storage" },
      { id: "referral", icon: Gift, label: "Refer & Earn", sublabel: "Invite a co-writer, you both benefit", to: "/settings/referral" },
      { id: "notifications", icon: Bell, label: "Notifications", to: "#" },
      { id: "privacy", icon: ShieldCheck, label: "Privacy & Security", to: "#" },
      { id: "tour", icon: Compass, label: "Show me around", sublabel: "A quick tour of your song's room", action: "tour" },
      { id: "signout", icon: LogOut, label: "Sign out", action: "signout", destructive: true },
    ],
    [accountSublabel],
  );

  const handleRow = async (row: SettingsRow) => {
    if (row.action === "signout") {
      await signOut();
      navigate("/auth/login", { replace: true });
      return;
    }
    if (row.action === "tour") {
      // Re-arm every tour beat and start where the tour starts: the catalog.
      resetTour();
      navigate("/");
      return;
    }
    if (row.to) navigate(row.to);
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(184,149,58,0.10) 0%, transparent 55%)",
        }}
      />

      <div
        className="relative px-6 pt-14 pb-40"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-8"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
        >
          Settings
        </h1>

        {/* Settings rows */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1px solid var(--cog-border)",
            boxShadow: "0 2px 16px rgba(28,26,23,0.06)",
          }}
        >
          {rows.map((row, idx) => {
            const Icon = row.icon;
            const isLast = idx === rows.length - 1;
            return (
              <button
                key={row.id}
                onClick={() => { void handleRow(row); }}
                className="w-full flex items-center gap-4 px-4 py-4 transition-all duration-150 active:bg-[rgba(184,149,58,0.06)] text-left"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--cog-border)" }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 38,
                    height: 38,
                    backgroundColor: row.accent
                      ? "rgba(184,149,58,0.13)"
                      : row.destructive
                      ? "rgba(180,60,60,0.08)"
                      : "rgba(28,26,23,0.06)",
                  }}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.6}
                    style={{
                      color: row.accent
                        ? "var(--cog-gold)"
                        : row.destructive
                        ? "#B43C3C"
                        : "var(--cog-warm-gray)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-base font-medium leading-snug"
                    style={{
                      color: row.destructive ? "#B43C3C" : "var(--cog-charcoal)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {row.label}
                  </p>
                  {row.sublabel && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--cog-muted)" }}>
                      {row.sublabel}
                    </p>
                  )}
                </div>
                {!row.destructive && (
                  <ChevronRight size={16} strokeWidth={1.5} style={{ color: "var(--cog-muted)", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Version */}
        <p
          className="text-xs text-center mt-8"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
        >
          Colors of Glory - v0.1.0-alpha
        </p>
      </div>

      <BottomNav active="settings" />
    </div>
  );
};

export default SettingsPage;
