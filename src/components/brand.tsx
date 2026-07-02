import Link from "next/link";
import { AudioLines } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({
  href = "/dashboard",
  className,
  inverse = false,
}: {
  href?: string;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 text-[14px] font-semibold tracking-[-0.015em] text-foreground",
        inverse && "text-white",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[7px] bg-foreground text-background",
          inverse && "bg-white text-[#1d1d1f]",
        )}
      >
        <AudioLines className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
      Poetry Shorts
    </Link>
  );
}
