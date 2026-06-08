import { useNavigate, useLocation } from "react-router-dom";
import { Music2, Settings, Mic } from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  matchPaths?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Capture",
    icon: Mic,
    path: "/",
    matchPaths: ["/"],
  },
  {
    label: "Songs",
    icon: Music2,
    path: "/songs",
    matchPaths: ["/songs"],
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
    matchPaths: ["/settings"],
  },
];

interface BottomNavProps {
  /** Override active tab if needed */
  active?: "capture" | "songs" | "settings";
}

const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (item: NavItem) => {
    if (active) {
      if (active === "capture" && item.label === "Capture") return true;
      if (active === "songs" && item.label === "Songs") return true;
      if (active === "settings" && item.label === "Settings") return true;
      return false;
    }
    const path = location.pathname;
    if (item.label === "Capture") return path === "/" || path === "/capture";
    if (item.label === "Songs") return path === "/songs" || path.startsWith("/songs/");
    if (item.label === "Settings") return path.startsWith("/settings/");
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around"
      style={{
        backgroundColor: "rgba(245,240,232,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(28,26,23,0.08)",
        height: 80,
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 500,
      }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 transition-all duration-150 active:scale-90"
            style={{
              minWidth: 64,
              minHeight: 52,
              paddingTop: 8,
              paddingBottom: 8,
              color: active ? "var(--cog-gold-alt)" : "var(--cog-muted)",
            }}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2 : 1.5}
              style={{
                color: active ? "var(--cog-gold)" : "var(--cog-muted)",
                transition: "color 150ms",
              }}
            />
            <span
              className="text-[10px] font-medium tracking-wide"
              style={{
                color: active ? "var(--cog-gold-alt)" : "var(--cog-muted)",
                fontFamily: "var(--font-body)",
                transition: "color 150ms",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
