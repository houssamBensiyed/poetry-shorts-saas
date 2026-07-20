"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";

import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/dashboard/profile",
    label: "Your profile",
    hint: "Photo and display name",
    icon: UserRound,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    hint: "Password, storage, Cloudinary",
    icon: Settings,
  },
];

export function UserMenu({
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      );

    // Move focus into the menu so keyboard users can act immediately.
    requestAnimationFrame(() => focusables()[0]?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const list = focusables();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      if (event.key === "ArrowDown") {
        list[(index + 1) % list.length]?.focus();
      } else {
        list[(index - 1 + list.length) % list.length]?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,113,227,0.25)]",
          open && "bg-secondary",
        )}
      >
        <Avatar
          src={avatarUrl}
          name={name}
          email={email}
          className="h-8 w-8 ring-1 ring-border"
        />
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[296px] animate-panel-in rounded-xl border border-border bg-card p-1.5 shadow-raised"
        >
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2.5">
            <Avatar
              src={avatarUrl}
              name={name}
              email={email}
              className="h-10 w-10"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-5">
                {displayName(name, email)}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {email}
              </p>
            </div>
            {role === "ADMIN" ? (
              <Badge tone="purple" className="ml-auto shrink-0">
                Admin
              </Badge>
            ) : null}
          </div>

          <div className="my-1 h-px bg-border" />

          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,113,227,0.3)]"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-5">
                    {item.label}
                  </span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
              </Link>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <div className="px-1 py-1.5">
            <p className="mb-1.5 px-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
              Appearance
            </p>
            <ThemeToggle compact />
          </div>

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,113,227,0.3)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
