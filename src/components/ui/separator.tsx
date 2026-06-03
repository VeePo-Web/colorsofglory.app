import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & { branded?: boolean }
>(({ className, orientation = "horizontal", decorative = true, branded = false, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      !branded && "bg-border",
      className,
    )}
    style={branded ? {
      background: orientation === "horizontal"
        ? "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.15), hsl(var(--gold-warm) / 0.1), transparent)"
        : "linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.15), hsl(var(--gold-warm) / 0.1), transparent)",
    } : undefined}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
