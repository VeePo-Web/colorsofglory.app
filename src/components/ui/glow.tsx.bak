import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * <Glow /> — the COG signature warm radial glow (CLAUDE.md §2.3).
 * Renders the same gradient as the .cog-glow class (single source:
 * tokens.css). Absolutely positioned, pointer-transparent; parent
 * must be position: relative.
 */
const Glow = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn("cog-glow pointer-events-none absolute inset-0", className)} />
);

export { Glow };
