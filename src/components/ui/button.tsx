import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-sans text-sm font-medium ring-offset-background transition-all duration-[var(--dur-fast)] ease-cog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cog-gold)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        // Primary CTA — earned gold pill, white text (CLAUDE.md §2.4 / §11.5)
        default: "bg-[var(--cog-gold)] text-white shadow-cog-sm hover:bg-[var(--cog-gold-light)] hover:shadow-cog-fab",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border/60 bg-background hover:bg-accent hover:text-accent-foreground hover:border-border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // Links are gold — earned accent
        link: "text-[var(--cog-gold)] underline-offset-4 hover:underline",
        editorial:
          "relative bg-transparent border border-border/60 text-foreground text-xs uppercase tracking-[0.15em] hover:bg-foreground hover:text-background hover:border-foreground overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
        sacred:
          "relative bg-gradient-to-r from-[var(--cog-gold)] to-[hsl(var(--gold-warm))] text-white hover:brightness-110 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
        xl: "h-12 px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
