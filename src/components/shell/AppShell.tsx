import type { ReactNode } from "react";

/**
 * AppShell — the one shared frame every main-app screen can compose into.
 *
 * It owns the shell AROUND a screen, never the screen's interior: the
 * --max-w-app centered mobile column (430 cap / 390 baseline), safe-area
 * padding, an optional signature gold glow, and slots for the nav chrome.
 * Feature screens render their content as `children`; they are never forced to
 * adopt this (pages that hand-roll their own frame keep working untouched), but
 * new screens should reach for it so the frame + glow stay identical app-wide.
 *
 * Page transitions are NOT handled here — the app's spatial entrance system
 * (`useSpatialEntrance` in src/lib/nav/navDirection.ts) owns per-surface motion.
 */
export interface AppShellProps {
  children: ReactNode;
  /** Sticky top chrome slot (e.g. BackHeader / SongTabBar). */
  header?: ReactNode;
  /** Bottom chrome slot (e.g. BottomNav). Rendered after the content column. */
  bottomNav?: ReactNode;
  /** Full-bleed layer behind the content, for shell-specific glow variants. */
  overlay?: ReactNode;
  /** Toggle the standard bottom-center gold glow (active-song screens). */
  glow?: boolean;
  /** Column background token. */
  background?: "cream" | "cream-light";
  /** Horizontal padding on the content column (default true → px-6). */
  padded?: boolean;
  className?: string;
  contentClassName?: string;
}

const BG = {
  cream: "var(--cog-cream)",
  "cream-light": "var(--cog-cream-light)",
} as const;

const AppShell = ({
  children,
  header,
  bottomNav,
  overlay,
  glow = false,
  background = "cream",
  padded = true,
  className,
  contentClassName,
}: AppShellProps) => (
  <div
    className={`relative min-h-screen pt-safe pb-safe ${className ?? ""}`}
    style={{ backgroundColor: BG[background] }}
  >
    {glow ? <div aria-hidden className="pointer-events-none fixed inset-0 cog-glow" /> : null}
    {overlay}
    {header}
    <div
      className={`relative mx-auto w-full max-w-[var(--max-w-app)] ${padded ? "px-6" : ""} ${contentClassName ?? ""}`}
    >
      {children}
    </div>
    {bottomNav}
  </div>
);

export default AppShell;
