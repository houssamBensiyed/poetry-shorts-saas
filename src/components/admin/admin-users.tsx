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

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Registered accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="p-4 text-[13px] text-muted-foreground">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-[13px] text-muted-foreground">
              No users found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Channels</th>
                    <th>Voices</th>
                    <th>Runs</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const busy = busyId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-start gap-2.5">
                            <Avatar
                              src={user.avatarUrl}
                              name={user.name}
                              email={user.email}
                              className="mt-0.5 h-7 w-7"
                            />
                            <div className="min-w-0">
                              <p className="font-medium">{user.email}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {user.id}
                              </p>
                              {isSelf ? (
                                <p className="text-[11px] text-link">You</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={user.role === "ADMIN" ? "purple" : "default"}>
                            {user.role}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={user.active ? "success" : "danger"}>
                            {user.active ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="tabular">{user.channelCount}</td>
                        <td className="tabular">{user.voiceCount}</td>
                        <td className="tabular">{user.queueRunCount}</td>
                        <td className="text-[11px] text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf || busy}
                              title={
                                isSelf
                                  ? "You cannot disable your own account"
                                  : undefined
                              }
                              onClick={() => void toggle(user)}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : user.active ? (
                                <ShieldOff className="h-3.5 w-3.5" />
                              ) : (
                                <ShieldCheck className="h-3.5 w-3.5" />
                              )}
                              {user.active ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isSelf || busy}
                              title={
                                isSelf
                                  ? "You cannot delete your own account"
                                  : "Delete user"
                              }
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void remove(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
