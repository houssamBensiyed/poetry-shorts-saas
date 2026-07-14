import { PlatformIcon } from "@/components/channels/platform-icon";

export type PlatformSlice = {
  service: string;
  label: string;
  count: number;
};

const colors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1))",
];

export function PlatformMix({ items }: { items: PlatformSlice[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-[13px] font-medium">No platform activity yet</p>
        <p className="meta mt-0.5">
          Platform totals appear after voices are scheduled or published.
        </p>
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.service}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
            <span className="flex items-center gap-2">
              <PlatformIcon service={item.service} />
              <span className="font-medium">{item.label}</span>
            </span>
            <span className="tabular text-muted-foreground">{item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.count / max) * 100, 4)}%`,
                background: colors[index % colors.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
