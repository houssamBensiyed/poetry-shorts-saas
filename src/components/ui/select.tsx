import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-lg border border-input bg-card px-2.5 pr-8 text-[13px] text-foreground transition-[border-color,box-shadow] duration-150 focus-visible:border-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.15)] disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
