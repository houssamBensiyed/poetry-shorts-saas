import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "success" &&
          "border-emerald-200/80 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "error" &&
          "border-rose-200/80 bg-rose-50/60 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
        tone === "info" && "border-border bg-card text-foreground/80",
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        className={cn(
          "mt-[3px] h-3.5 w-3.5 shrink-0",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "error" && "text-rose-600 dark:text-rose-400",
          tone === "info" && "text-muted-foreground",
        )}
        strokeWidth={2}
      />
      <div>{children}</div>
    </div>
  );
}
