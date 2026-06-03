import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

 
const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-[11px] font-sans font-medium tracking-[0.04em] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border/60",
        editorial: "border-border/40 bg-transparent text-muted-foreground uppercase tracking-[0.12em] text-[10px]",
        sacred: "border-transparent text-primary-foreground bg-gradient-to-r from-primary/90 to-[hsl(var(--gold-warm)/0.8)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
