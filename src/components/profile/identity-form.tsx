"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, errorText } from "@/lib/client";

export function IdentityForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setNotice("Display name updated.");
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="How your name appears in the app"
          autoComplete="name"
          required
        />
        <p className="text-[11.5px] text-muted-foreground">
          Shown in the header, dashboard greeting, and account menu.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-email">Email</Label>
        <Input
          id="account-email"
          value={email}
          readOnly
          disabled
          aria-describedby="account-email-note"
        />
        <p id="account-email-note" className="text-[11.5px] text-muted-foreground">
          The sign-in email cannot be changed here.
        </p>
      </div>

      <Button
        type="submit"
        disabled={saving || name.trim().length === 0 || name.trim() === initialName}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  );
}
