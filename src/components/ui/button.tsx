import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium leading-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.22)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background shadow-[0_1px_1px_rgba(0,0,0,0.04)] hover:bg-foreground/90 active:bg-foreground/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-strong active:bg-surface-strong",
        outline:
          "border border-input bg-card text-foreground hover:bg-surface active:bg-surface-strong",
        ghost:
          "text-foreground/75 hover:bg-surface hover:text-foreground active:bg-surface-strong",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        link: "h-auto p-0 text-link hover:underline hover:underline-offset-4",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-7 rounded-md px-2.5 text-[12px]",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
