import { Link, NavLink } from "react-router-dom";

const navItem = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? "bg-[var(--cog-charcoal)] text-[var(--cog-cream)]"
      : "text-[var(--cog-warm-gray)] hover:text-[var(--cog-charcoal)]"
  }`;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cog-cream)] text-[var(--cog-charcoal)]">
      <header className="border-b border-[var(--cog-border)] bg-[var(--cog-cream-light)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[var(--cog-warm-gray)]">
              Admin
            </span>
            <nav className="flex items-center gap-1">
              <NavLink to="/admin" end className={navItem}>Home</NavLink>
              <NavLink to="/admin/founders" className={navItem}>Founders</NavLink>
              <NavLink to="/admin/codes" className={navItem}>Codes</NavLink>
              <NavLink to="/admin/payouts" className={navItem}>Payouts</NavLink>
            </nav>
          </div>
          <Link to="/" className="text-xs text-[var(--cog-warm-gray)] hover:text-[var(--cog-charcoal)]">
            ← App
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}