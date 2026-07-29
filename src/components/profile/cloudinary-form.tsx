"use client";

import { useState } from "react";
import { Cloud, Loader2, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, errorText } from "@/lib/client";

type SaveResult = {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  warning: string | null;
};

export function CloudinaryForm({
  initialCloudName,
  initialApiKey,
  configured,
  hasSecret,
}: {
  initialCloudName: string;
  initialApiKey: string;
  configured: boolean;
  hasSecret: boolean;
}) {
  const [cloudName, setCloudName] = useState(initialCloudName);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [apiSecret, setApiSecret] = useState("");
  const [savedCloudName, setSavedCloudName] = useState(initialCloudName);
  const [savedApiKey, setSavedApiKey] = useState(initialApiKey);
  const [isConfigured, setIsConfigured] = useState(configured);
  const [secretSaved, setSecretSaved] = useState(hasSecret);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    setWarning(null);

    try {
      const result = await apiFetch<SaveResult>("/api/profile/cloudinary", {
        method: "PUT",
        body: JSON.stringify({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
        }),
      });

      setSavedCloudName(cloudName.trim());
      setSavedApiKey(apiKey.trim());
      setIsConfigured(result.configured);
      setSecretSaved(true);
      setApiSecret("");
      if (result.warning) {
        setWarning(result.warning);
      } else {
        setNotice("Cloudinary is connected. New uploads use this account.");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    setNotice(null);
    setWarning(null);

    try {
      await apiFetch<{ ok: boolean }>("/api/profile/cloudinary", {
        method: "DELETE",
      });
      setCloudName("");
      setApiKey("");
      setApiSecret("");
      setSavedCloudName("");
      setSavedApiKey("");
      setIsConfigured(false);
      setSecretSaved(false);
      setConfirmRemove(false);
      setNotice("Cloudinary was removed from your account.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRemoving(false);
    }
  }

  const unchanged =
    isConfigured &&
    cloudName.trim() === savedCloudName &&
    apiKey.trim() === savedApiKey &&
    apiSecret.trim().length === 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-4 w-4" /> Cloudinary
            </CardTitle>
            <p className="meta mt-1.5">
              Stores the voice recordings and reels this app uploads. Uploads
              use this account only.
            </p>
          </div>
          <Badge tone={isConfigured ? "success" : "warning"}>
            {isConfigured ? "Connected" : "Not set up"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {warning ? <Alert tone="info">{warning}</Alert> : null}

        {isConfigured ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3 text-[12px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              Connected to <span className="font-medium text-foreground">{savedCloudName}</span>.
              The API secret is stored securely and is never shown again. Leave
              the secret field blank to keep the saved one.
            </p>
          </div>
        ) : null}

        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cloudinary-cloud-name">Cloud name</Label>
              <Input
                id="cloudinary-cloud-name"
                value={cloudName}
                onChange={(event) => setCloudName(event.target.value)}
                placeholder="my-cloud"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cloudinary-api-key">API key</Label>
              <Input
                id="cloudinary-api-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="123456789012345"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cloudinary-api-secret">API secret</Label>
            <Input
              id="cloudinary-api-secret"
              type="password"
              value={apiSecret}
              onChange={(event) => setApiSecret(event.target.value)}
              placeholder={
                secretSaved ? "Saved. Leave blank to keep it." : "Your API secret"
              }
              autoComplete="new-password"
              required={!secretSaved}
            />
          </div>

          <p className="text-[12px] text-muted-foreground">
            Find these values in the Cloudinary dashboard under{" "}
            <span className="font-medium text-foreground">
              Settings &gt; API Keys
            </span>
            . Use the cloud name, not the full URL.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={saving || unchanged}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isConfigured ? "Save changes" : "Connect Cloudinary"}
            </Button>

            {isConfigured ? (
              confirmRemove ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void remove()}
                    disabled={removing}
                  >
                    {removing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRemove(false)}
                    disabled={removing}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmRemove(true)}
                  disabled={saving}
                >
                  Remove account
                </Button>
              )
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
