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
