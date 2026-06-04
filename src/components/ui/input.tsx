import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.15)] disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:opacity-60",
      "file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium file:text-foreground hover:file:bg-surface-strong",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
