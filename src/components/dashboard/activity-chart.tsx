import { cn } from "@/lib/utils";

export type ActivityDay = {
  key: string;
  short: string;
  full: string;
  voices: number;
  published: number;
};

export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const max = Math.max(
    1,
    ...days.map((day) => Math.max(day.voices, day.published)),
  );
  const totals = days.reduce(
    (sum, day) => ({
      voices: sum.voices + day.voices,
      published: sum.published + day.published,
    }),
    { voices: 0, published: 0 },
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-1))]" />
            Added
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-2))]" />
            Published
          </span>
        </div>
        <p className="tabular text-[11.5px] text-muted-foreground">
          {totals.voices} added · {totals.published} published
        </p>
      </div>

      <div className="relative mt-4 h-44">
        <div aria-hidden className="absolute inset-x-0 inset-y-0">
          {[0, 25, 50, 75, 100].map((line) => (
            <div
              key={line}
              className="absolute inset-x-0 border-t border-border/60"
              style={{ bottom: `${line}%` }}
            />
          ))}
        </div>
