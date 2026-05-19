import { NextResponse } from "next/server";

import { isUuid, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { QueueEnqueueError, QueueRunError, startQueueRun } from "@/lib/runs";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Voice not found", 404);

  const voice = await prisma.voice.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!voice) return jsonError("Voice not found", 404);
  if (voice.status !== "failed") {
    return jsonError("Only failed voices can be retried", 409);
  }

  try {
    const run = await startQueueRun(user.id, [voice.id]);
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    if (error instanceof QueueEnqueueError) {
      return jsonError(error.message, 503);
    }
    if (error instanceof QueueRunError) {
      return jsonError(error.message, 409);
    }
    console.error("Voice retry failed", error);
    return jsonError("Could not retry this voice", 500);
  }
}
