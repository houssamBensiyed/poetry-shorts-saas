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
