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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  if (!isUuid(params.id)) return jsonError("User not found", 404);

  if (params.id === auth.user.id) {
    return jsonError("You cannot delete your own admin account", 409);
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!target) return jsonError("User not found", 404);

  const blocker = await prisma.voice.findFirst({
    where: {
      userId: target.id,
      OR: [
        { status: { in: [...ACTIVE_STATUSES] } },
        { queueRun: { status: { in: [...ACTIVE_STATUSES] } } },
        {
          publishes: {
            some: {
              buffer_post_id: { not: null },
              status: { not: "failed" },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (blocker) {
    return jsonError(
      "This user still has active runs or posts in Buffer. Finish or remove them before deleting the account.",
      409,
    );
  }

  const localVoices = await prisma.voice.findMany({
    where: { userId: target.id, storage_mode: "LOCAL" },
    select: { audio_url: true, rendered_video_url: true },
  });

  try {
    await prisma.user.delete({ where: { id: target.id } });
  } catch (error) {
    console.error("Could not delete user", error);
    return jsonError(errorMessage(error), 500);
  }

  for (const voice of localVoices) {
    for (const stored of [voice.audio_url, voice.rendered_video_url]) {
      if (!stored) continue;
      try {
        await unlink(await resolveLocalFile(stored, { mustExist: false }));
      } catch {
        // Best effort cleanup.
      }
    }
  }

  return NextResponse.json({ ok: true });
}
