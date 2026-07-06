import { Instagram, Music2, Youtube } from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthShell({
  title,
  description,
  art,
  children,
  footer,
}: {
  title: string;
  description: string;
  art: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="absolute right-4 top-4 z-20 hidden sm:right-6 sm:top-6 lg:block">
        <ThemeToggle compact />
      </div>
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#0b0b0c] lg:block">
        <img
          src={art}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent" />

        <div className="relative flex min-h-screen flex-col p-10 xl:p-14">
          <Brand href="/login" inverse />

          <div className="flex-1" />

          <div className="max-w-[420px] pb-4">
            <h2 className="text-balance text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] text-white">
              Poetry, cut for the feed.
            </h2>
            <p className="mt-5 max-w-[340px] text-[14.5px] leading-relaxed text-white/65">
              Turn spoken poetry into vertical shorts and publish them across
              your channels on a schedule.
            </p>

            <div className="mt-8 flex items-center gap-2">
              {[Youtube, Instagram, Music2].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 backdrop-blur-md"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <Brand href="/login" />
          <ThemeToggle compact />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[376px] animate-fade-up">
            <div className="relative mb-8 h-32 overflow-hidden rounded-2xl lg:hidden">
              <img
                src={art}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15" />
              <p className="absolute bottom-4 left-4 max-w-[240px] text-[17px] font-semibold leading-tight tracking-[-0.03em] text-white">
                Poetry, cut for the feed.
              </p>
            </div>

            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em]">
              {title}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>

            <div className="mt-8">{children}</div>

            <div className="mt-6 text-[12.5px] text-muted-foreground">
              {footer}
            </div>
          </div>
        </div>

        <p className="hidden text-[11px] text-muted-foreground/70 lg:block">
          Poetry Shorts
        </p>
      </main>
    </div>
  );
}
