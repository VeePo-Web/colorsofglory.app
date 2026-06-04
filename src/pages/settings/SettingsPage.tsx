import { useNavigate } from "react-router-dom";
import {
  HardDrive,
  Gift,
  Crown,
  ChevronRight,
  User,
  Bell,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import BottomNav from "@/components/cog/BottomNav";

interface SettingsRow {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  to?: string;
  accent?: boolean;
  destructive?: boolean;
}

const ROWS: SettingsRow[] = [
  { icon: User,      label: "Account",          sublabel: "officallulas@gmail.com", to: "#" },
  { icon: Crown,     label: "Upgrade to Pro",   sublabel: "Unlock 50 songs · 100GB · exports", to: "/upgrade", accent: true },
  { icon: HardDrive, label: "Storage",          sublabel: "850MB of 1GB used", to: "/settings/storage" },
  { icon: Gift,      label: "Refer & Earn",     sublabel: "$10/month per active Pro referral", to: "/settings/referral" },
  { icon: Bell,      label: "Notifications",    to: "#" },
  { icon: ShieldCheck, label: "Privacy & Security", to: "#" },
  { icon: LogOut,    label: "Sign out",         to: "/auth/login", destructive: true },
];

const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
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
          <CogLogo size="sm" />
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
          {ROWS.map((row, idx) => {
            const Icon = row.icon;
            const isLast = idx === ROWS.length - 1;
            return (
              <button
                key={row.label}
                onClick={() => row.to && navigate(row.to)}
                className="w-full flex items-center gap-4 px-4 py-4 transition-all duration-150 active:bg-[rgba(184,149,58,0.06)] text-left"
                style={{
                  borderBottom: isLast ? "none" : "1px solid var(--cog-border)",
                }}
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
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "var(--cog-muted)" }}
                    >
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
          Colors of Glory · v0.1.0-alpha
        </p>
      </div>

      <BottomNav active="settings" />
    </div>
  );
};

export default SettingsPage;
