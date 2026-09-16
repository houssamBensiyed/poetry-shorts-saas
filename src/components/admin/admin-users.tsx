"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorText } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  active: boolean;
  createdAt: string;
  channelCount: number;
  voiceCount: number;
  queueRunCount: number;
};

type AdminPayload = {
  users: AdminUser[];
  currentUserId: string;
};

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await apiFetch<AdminPayload>("/api/admin");
      setUsers(data.users);
      setCurrentUserId(data.currentUserId);
      if (!silent) setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      setNotice(
        `${user.email} ${user.active ? "disabled" : "enabled"} successfully.`,
      );
      await load(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(user: AdminUser) {
    if (
      !window.confirm(
        `Delete ${user.email}? All channels, voices, and queue runs will be removed.`,
      )
    ) {
      return;
    }
    setBusyId(user.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setNotice(`${user.email} deleted.`);
      await load(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  const activeUsers = users.filter((user) => user.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-lede">
            {users.length} registered account{users.length === 1 ? "" : "s"} ·{" "}
            {activeUsers} active. Disabled accounts cannot sign in.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>
