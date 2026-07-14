export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

export function StatusDonut({
  slices,
  total,
  label,
}: {
  slices: DonutSlice[];
  total: number;
  label: string;
}) {
  let cursor = 0;
  const stops = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = (cursor / Math.max(total, 1)) * 100;
      cursor += slice.value;
      const end = (cursor / Math.max(total, 1)) * 100;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="relative h-[132px] w-[132px] shrink-0 rounded-full"
        style={{
          background:
            total > 0
              ? `conic-gradient(${stops})`
              : "hsl(var(--surface-strong))",
        }}
        role="img"
        aria-label={`${label}: ${total} voices`}
      >
        <div className="absolute inset-[17px] flex flex-col items-center justify-center rounded-full bg-card">
          <span className="tabular text-[24px] font-semibold leading-none tracking-[-0.03em]">
            {total}
          </span>
          <span className="mt-1 text-[10.5px] text-muted-foreground">
            {total === 1 ? "voice" : "voices"}
          </span>
        </div>
      </div>

      <ul className="min-w-[150px] flex-1 space-y-2">
        {slices.map((slice) => {
          const percent =
            total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li
              key={slice.label}
              className="flex items-center justify-between gap-3 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="text-muted-foreground">{slice.label}</span>
              </span>
              <span className="tabular font-medium">
                {slice.value}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  {percent}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
