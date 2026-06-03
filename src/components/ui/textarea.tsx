import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <div className="relative group/textarea">
      {/* Left accent bar — appears on focus */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within/textarea:w-[2px] group-focus-within/textarea:h-[60%] rounded-full"
        style={{ background: "linear-gradient(to bottom, hsl(var(--primary) / 0.5), hsl(var(--gold-warm) / 0.3))" }}
        aria-hidden="true"
      />
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-sm border border-input bg-background px-3 py-2 font-sans text-base sm:text-[14px] ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:border-border/80 group-focus-within/textarea:pl-4",
          className,
        )}
        ref={ref}
        {...props}
      />
      {/* Focus accent line — slides in from center */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1.5px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-0 group-focus-within/textarea:w-full rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(var(--gold-warm) / 0.3), hsl(var(--primary) / 0.2))" }}
        aria-hidden="true"
      />
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
