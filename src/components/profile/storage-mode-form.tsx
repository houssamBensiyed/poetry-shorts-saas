"use client";

import { useState } from "react";
import { Cloud, HardDrive, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorText } from "@/lib/client";
import { cn } from "@/lib/utils";

type StorageMode = "LOCAL" | "REMOTE";

export function StorageModeForm({
  initial,
  localConfigured,
  cloudinaryConfigured,
}: {
  initial: StorageMode;
  localConfigured: boolean;
  cloudinaryConfigured: boolean;
}) {
  const [mode, setMode] = useState<StorageMode>(initial);
  const [pending, setPending] = useState<StorageMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function choose(next: StorageMode) {
    if (next === mode || saving) return;
    setSaving(true);
    setPending(next);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/profile/storage", {
        method: "PATCH",
        body: JSON.stringify({ storage_mode: next }),
      });
      setMode(next);
      setNotice(
        next === "LOCAL"
          ? "New voices will be stored on this server."
          : "New voices will be uploaded to Cloudinary.",
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>File storage</CardTitle>
        <p className="meta">
          Applies to new voices. Queued and rendered voices keep the mode they
          were uploaded with.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void choose("REMOTE")}
            disabled={saving}
            className={cn(
              "rounded-lg border p-3.5 text-left transition-colors",
              mode === "REMOTE"
                ? "border-foreground bg-surface"
                : "border-border hover:bg-surface",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <Cloud className="h-4 w-4" /> Remote
              {pending === "REMOTE" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
            </span>
            <span className="mt-1 block text-[12px] text-muted-foreground">
              The voice goes to your Cloudinary account. Buffer gets the reel
              link directly.
            </span>
          </button>

          <button
            type="button"
            onClick={() => void choose("LOCAL")}
            disabled={saving || !localConfigured}
            className={cn(
              "rounded-lg border p-3.5 text-left transition-colors",
              mode === "LOCAL"
                ? "border-foreground bg-surface"
                : "border-border hover:bg-surface",
              !localConfigured && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <HardDrive className="h-4 w-4" /> Local
              {pending === "LOCAL" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
            </span>
            <span className="mt-1 block text-[12px] text-muted-foreground">
              Voice and reel stay in the shared folder. If a voice publishes to
              Buffer, only the final reel is uploaded to Cloudinary.
            </span>
          </button>
        </div>

        {!localConfigured ? (
          <p className="text-[12px] text-amber-700">
            Local mode is unavailable until <code>LOCAL_MEDIA_ROOT</code> points
            at a folder shared with the render engine.
          </p>
        ) : null}

        {!cloudinaryConfigured ? (
          <p className="text-[12px] text-amber-700">
            Cloudinary is not connected. Remote uploads, and local voices that
            publish to Buffer, need it. Connect an account in the Cloudinary
            section below.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
