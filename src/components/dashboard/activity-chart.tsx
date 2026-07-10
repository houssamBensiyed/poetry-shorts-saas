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

        <div className="absolute inset-0 flex items-end gap-[3px] px-0.5">
          {days.map((day) => {
            const voiceHeight = (day.voices / max) * 100;
            const publishHeight = (day.published / max) * 100;
            return (
              <div
                key={day.key}
                className="group/bar relative flex h-full flex-1 items-end justify-center gap-[3px]"
                title={`${day.full}: ${day.voices} added, ${day.published} published`}
              >
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-raised group-hover/bar:block">
                  <span className="font-medium">{day.full}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {day.voices} added · {day.published} published
                  </span>
                </span>
                <span
                  className={cn(
                    "w-full max-w-[9px] rounded-t-[3px] bg-[hsl(var(--chart-1))] transition-opacity",
                    day.voices === 0 && "opacity-15",
                  )}
                  style={{ height: `${day.voices === 0 ? 2 : Math.max(voiceHeight, 4)}%` }}
                />
                <span
                  className={cn(
                    "w-full max-w-[9px] rounded-t-[3px] bg-[hsl(var(--chart-2))] transition-opacity",
                    day.published === 0 && "opacity-15",
                  )}
                  style={{ height: `${day.published === 0 ? 2 : Math.max(publishHeight, 4)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] text-muted-foreground">
        <span>{days[0]?.short}</span>
        <span>{days[Math.floor(days.length / 2)]?.short}</span>
        <span>{days[days.length - 1]?.short}</span>
      </div>

      <table className="sr-only">
        <caption>Voice activity for the last {days.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Voices added</th>
            <th scope="col">Voices published</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.key}>
              <th scope="row">{day.full}</th>
              <td>{day.voices}</td>
              <td>{day.published}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
