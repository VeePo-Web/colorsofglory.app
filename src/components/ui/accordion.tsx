import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "relative border-b border-border/40 group/accordion transition-colors duration-300 data-[state=open]:bg-muted/10",
      className,
    )}
    {...props}
  >
    {/* Gold left accent — visible on open via CSS data-state selector */}
    <div
      className="absolute left-0 top-0 bottom-0 w-0 transition-all duration-500 group-data-[state=open]/accordion:w-[2px]"
      style={{ background: "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--gold-warm) / 0.4))" }}
      aria-hidden="true"
    />
    {/* Warm radial glow — appears when open */}
    <div
      className="absolute inset-0 opacity-0 group-data-[state=open]/accordion:opacity-100 transition-opacity duration-700 pointer-events-none"
      style={{ background: "radial-gradient(ellipse 80% 60% at 0% 50%, hsl(var(--primary) / 0.015), transparent 60%)" }}
      aria-hidden="true"
    />
    {props.children}
  </AccordionPrimitive.Item>
));
AccordionItem.displayName = "AccordionItem";

/**
 * Branded cross/plus indicator that morphs to a minus on open.
 * The vertical bar rotates 90° to collapse into a horizontal line.
 * Uses the brand primary → gold-warm gradient for warmth.
 */
const CrossIndicator = () => (
  <span className="relative flex items-center justify-center size-5 shrink-0" aria-hidden="true">
    {/* Horizontal bar — always visible */}
    <span
      className="absolute w-3 h-[1.2px] rounded-full transition-colors duration-500"
      style={{ background: "hsl(var(--muted-foreground) / 0.35)" }}
    />
    {/* Vertical bar — rotates to 0 on open, creating the plus → minus morph */}
    <span
      className="absolute w-[1.2px] h-3 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[state=open]/accordion:rotate-90 group-data-[state=open]/accordion:opacity-0"
      style={{ background: "hsl(var(--muted-foreground) / 0.35)" }}
    />
    {/* Subtle glow dot at intersection — appears on open */}
    <span
      className="absolute size-1 rounded-full opacity-0 group-data-[state=open]/accordion:opacity-100 transition-opacity duration-700"
      style={{ background: "hsl(var(--primary) / 0.25)" }}
    />
  </span>
);

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-5 font-serif font-medium transition-colors duration-300 hover:text-foreground/70 [&[data-state=open]]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CrossIndicator />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm font-sans leading-relaxed text-muted-foreground transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-5 pt-0 pl-0.5 animate-[fade-in_0.4s_ease-out_0.1s_both] data-[state=closed]:opacity-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
