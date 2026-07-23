"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, HardDrive, KeyRound, Palette } from "lucide-react";

import { cn } from "@/lib/utils";

const sections = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "password", label: "Password", icon: KeyRound },
  { id: "storage", label: "File storage", icon: HardDrive },
  { id: "cloudinary", label: "Cloudinary", icon: Cloud },
];

export function SettingsNav() {
  const [active, setActive] = useState(sections[0].id);

  useEffect(() => {
    // Deep links such as /dashboard/settings#storage open the right item.
    function syncFromHash() {
      const id = window.location.hash.replace("#", "");
      if (sections.some((section) => section.id === id)) setActive(id);
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <nav aria-label="Settings sections" className="sticky top-24 space-y-0.5">
      {sections.map((section) => {
        const Icon = section.icon;
        const current = active === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={current ? "true" : undefined}
            onClick={() => setActive(section.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,113,227,0.3)]",
              current
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {section.label}
          </a>
        );
      })}
      <Link
        href="/dashboard/profile"
        className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,113,227,0.3)]"
      >
        Edit profile and photo
      </Link>
    </nav>
  );
}
