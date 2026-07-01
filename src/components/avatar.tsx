"use client";

import { useState } from "react";

import { defaultAvatarFor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  email,
  className,
}: {
  src?: string | null;
  name?: string | null;
  email: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = src && !failed ? src : defaultAvatarFor(email);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-foreground",
        className ?? "h-9 w-9",
      )}
    >
      {failed ? (
        <span className="text-[11px] font-semibold tracking-wide">
          {initials(name, email)}
        </span>
      ) : (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
