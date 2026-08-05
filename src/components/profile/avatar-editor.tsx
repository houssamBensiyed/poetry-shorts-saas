"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, RotateCcw } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch, errorText } from "@/lib/client";
import { DEFAULT_AVATARS, defaultAvatarFor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 256;

async function resizeImage(file: File): Promise<string> {
  const source = await new Promise<ImageBitmap | HTMLImageElement>(
    (resolve, reject) => {
      if ("createImageBitmap" in window) {
        createImageBitmap(file).then(resolve, reject);
        return;
      }
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The image could not be read"));
      };
      image.src = url;
    },
  );

  const width = source.width;
  const height = source.height;
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be processed");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  if ("close" in source && typeof source.close === "function") source.close();

  const dataUrl = canvas.toDataURL("image/webp", 0.86);
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("This browser could not prepare the image");
  }
  return dataUrl;
}

export function AvatarEditor({
  initialAvatar,
  email,
  name,
}: {
  initialAvatar: string | null;
  email: string;
  name: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(initialAvatar);
  const [customData, setCustomData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const preview = draft ?? defaultAvatarFor(email);
  const unchanged = draft === initialAvatar && customData === null;

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }

    setReading(true);
    try {
      const dataUrl = await resizeImage(file);
      setDraft(dataUrl);
      setCustomData(dataUrl);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (saving || unchanged) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (customData) {
        await apiFetch("/api/profile/avatar", {
          method: "PUT",
          body: JSON.stringify({ dataUrl: customData }),
        });
      } else {
        await apiFetch("/api/profile/avatar", {
          method: "PUT",
          body: JSON.stringify({ preset: draft ?? defaultAvatarFor(email) }),
        });
      }
      setCustomData(null);
      setNotice("Profile picture updated.");
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/api/profile/avatar", { method: "DELETE" });
      setDraft(null);
      setCustomData(null);
      setNotice("Default picture restored.");
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <Avatar
            src={preview}
            name={name}
            email={email}
            className="h-20 w-20 ring-1 ring-border"
          />
          {reading ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Profile picture</p>
          <p className="mt-0.5 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
            Upload a photo or pick one of the built-in artworks. Uploads are
            cropped to a square and resized in your browser.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={chooseFile}
              aria-label="Upload a profile picture"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={reading || saving || removing}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Upload photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void restoreDefault()}
              disabled={reading || saving || removing || initialAvatar === null}
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Use default
            </Button>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
          Built-in artwork
        </p>
        <div className="grid grid-cols-6 gap-2 sm:max-w-[360px]">
          {DEFAULT_AVATARS.map((avatar) => {
            const active = draft === avatar;
            return (
              <button
                key={avatar}
                type="button"
                aria-pressed={active}
                aria-label={`Use avatar ${avatar.slice(-6, -4)}`}
                onClick={() => {
                  setDraft(avatar);
                  setCustomData(null);
                  setNotice(null);
                  setError(null);
                }}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border-2 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,113,227,0.4)]",
                  active ? "border-foreground" : "border-transparent",
                )}
              >
                <img
                  src={avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {active ? (
                  <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || reading || unchanged || removing}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save picture
        </Button>
        {!unchanged ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(initialAvatar);
              setCustomData(null);
              setError(null);
              setNotice(null);
            }}
            disabled={saving || reading || removing}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
