import { NavLink } from "react-router-dom";

const links = [
  { to: "/admin", label: "Home", end: true },
  { to: "/admin/founders", label: "Founders" },
  { to: "/admin/codes", label: "Codes" },
  { to: "/admin/referrals", label: "Referrals" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/finance", label: "Finance" },
  { to: "/admin/webhooks", label: "Webhooks" },
  { to: "/admin/fraud", label: "Fraud" },
  { to: "/admin/attribution", label: "Attribution" },
  { to: "/admin/auth-security", label: "Auth" },
  { to: "/admin/audit", label: "Audit" },
];

export default function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-[var(--cog-cream)] text-[var(--cog-charcoal)]">
      <header className="border-b border-[var(--cog-border)] bg-[var(--cog-cream-light)]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center gap-6">
          <div className="font-semibold tracking-tight">COG Admin</div>
          <nav className="flex gap-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-[var(--cog-gold)] text-white"
                      : "text-[var(--cog-warm-gray)] hover:bg-[rgba(184,149,58,0.10)]"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto text-xs text-[var(--cog-muted)]">Internal · Not public</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {title && <h1 className="text-2xl font-semibold mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
}