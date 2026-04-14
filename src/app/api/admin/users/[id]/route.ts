import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorMessage, isUuid, jsonError, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { resolveLocalFile } from "@/lib/storage";

const ACTIVE_STATUSES = ["processing", "rendered", "submitting"] as const;

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  active: z.boolean(),
});

async function requireAdminApi() {
  const user = await getSessionUser();
  if (!user) return { error: jsonError("Unauthorized", 401) } as const;
  if (user.role !== "ADMIN") return { error: jsonError("Forbidden", 403) } as const;
  return { user } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  if (!isUuid(params.id)) return jsonError("User not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  if (params.id === auth.user.id && !parsed.data.active) {
    return jsonError("You cannot disable your own admin account", 409);
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, active: true },
  });
  if (!target) return jsonError("User not found", 404);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { active: parsed.data.active },
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { channels: true, voices: true, queueRuns: true } },
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      active: updated.active,
      createdAt: updated.createdAt,
      channelCount: updated._count.channels,
      voiceCount: updated._count.voices,
      queueRunCount: updated._count.queueRuns,
    },
  });
}
