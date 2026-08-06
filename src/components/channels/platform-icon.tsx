import {
  AtSign,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Music2,
  Pin,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { serviceLabel } from "@/lib/youtube";

const icons: Record<string, LucideIcon> = {
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  x: Twitter,
  tiktok: Music2,
  threads: AtSign,
  pinterest: Pin,
  telegram: Send,
  mastodon: MessageCircle,
  googlebusiness: MapPin,
};

const colors: Record<string, string> = {
  youtube: "text-[#f0002a]",
  instagram: "text-[#d62976]",
  facebook: "text-[#1877f2]",
  linkedin: "text-[#0a66c2]",
  twitter: "text-foreground",
  x: "text-foreground",
  tiktok: "text-foreground",
  threads: "text-foreground",
  pinterest: "text-[#e60023]",
  telegram: "text-[#229ed9]",
  mastodon: "text-[#6364ff]",
  googlebusiness: "text-[#4285f4]",
};

export function PlatformIcon({
  service,
  className,
}: {
  service: string;
  className?: string;
}) {
  const key = service.toLowerCase();
  const Icon = icons[key] ?? Globe;
  return (
    <Icon
      aria-hidden
      strokeWidth={2.1}
      className={cn("h-3.5 w-3.5", colors[key] ?? "text-foreground", className)}
    />
  );
}

export function PlatformChip({
  service,
  className,
}: {
  service: string;
  className?: string;
}) {
  return (
    <span
      title={serviceLabel(service)}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border border-black/5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      <PlatformIcon service={service} />
      <span className="sr-only">{serviceLabel(service)}</span>
    </span>
  );
}
