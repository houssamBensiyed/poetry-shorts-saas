"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/dashboard/user-menu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/channels", label: "Channels" },
  { href: "/dashboard/voices", label: "Voices" },
  { href: "/dashboard/queue", label: "Queue" },
];

const adminLinks = [
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/queue", label: "Queue health" },
];

export function DashboardNav({
  email,
  name,
  role,
  avatarUrl,
}: {
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  }

  function NavLink({ href, label }: { href: string; label: string }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.22)]",
          active
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--nav)/0.85)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
        <div className="flex h-14 items-center gap-5">
          <Brand />

          <nav
            aria-label="Primary"
            className="hidden items-center gap-0.5 md:flex"
          >
            {links.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
            {role === "ADMIN" ? (
              <>
                <span aria-hidden className="mx-2 h-4 w-px bg-border" />
                {adminLinks.map((link) => (
                  <NavLink key={link.href} {...link} />
                ))}
              </>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              email={email}
              name={name}
              role={role}
              avatarUrl={avatarUrl}
            />
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="no-scrollbar -mx-1 flex items-center gap-0.5 overflow-x-auto px-1 pb-2 md:hidden"
        >
          {links.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
          {role === "ADMIN" ? (
            <>
              <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-border" />
              {adminLinks.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
