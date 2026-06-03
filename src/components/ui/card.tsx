import * as React from "react";

import { cn } from "@/lib/utils";

/** Gold filigree corner ornament */
const CornerOrnament = ({ className }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className={cn("absolute opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none", className)}
    aria-hidden="true"
  >
    <path
      d="M0,12 L0,3 Q0,0 3,0 L12,0"
      stroke="hsl(var(--gold-warm))"
      strokeWidth="0.5"
      strokeOpacity="0.25"
      fill="none"
    />
    <rect
      x="0"
      y="0"
      width="2"
      height="2"
      rx="0.25"
      transform="rotate(45 1 1)"
      fill="hsl(var(--gold-warm))"
      fillOpacity="0.15"
    />
  </svg>
);

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "group/card relative rounded-sm border border-border/50 bg-card text-card-foreground shadow-sm transition-all duration-500 hover:shadow-md hover:border-border/70 overflow-hidden",
      className
    )}
    {...props}
  >
    {/* Gold left accent bar */}
    <div
      className="absolute left-0 top-0 bottom-0 w-0 group-hover/card:w-[2px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
      style={{ background: "linear-gradient(to bottom, hsl(var(--primary) / 0.4), hsl(var(--gold-warm) / 0.2))" }}
      aria-hidden="true"
    />
    {/* Top accent line */}
    <div
      className="absolute top-0 left-0 right-0 h-px scale-x-0 group-hover/card:scale-x-100 transition-transform duration-700 origin-left z-10"
      style={{ background: "linear-gradient(90deg, hsl(var(--gold-warm) / 0.25), hsl(var(--primary) / 0.15), transparent)" }}
      aria-hidden="true"
    />
    <CornerOrnament className="top-2 left-2" />
    {props.children}
  </div>
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-serif text-2xl font-light leading-none tracking-tight", className)}
      style={{ fontFeatureSettings: '"liga" 1, "dlig" 1' }}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
