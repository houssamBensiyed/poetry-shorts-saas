import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.15)] disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:opacity-60",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
