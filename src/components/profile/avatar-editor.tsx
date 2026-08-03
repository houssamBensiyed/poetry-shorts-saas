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
