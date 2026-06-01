import { NextResponse } from "next/server";

import { jsonError, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recordPublishResults } from "@/lib/publish-status";
import { publishWebhookSchema } from "@/lib/validation";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export const dynamic = "force-dynamic";

/**
 * Callback from Project 03 after it creates the Buffer posts. The worker also
 * stores the HTTP response, so duplicate callbacks are safe: statuses only move
 * forward and each destination is one row.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = publishWebhookSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const voice = await prisma.voice.findUnique({
    where: { id: parsed.data.voice_id },
    select: {
      id: true,
      status: true,
      publishes: {
        select: {
          destinationId: true,
          destination: { select: { buffer_channel_id: true } },
        },
      },
    },
  });
  if (!voice) return jsonError("Unknown voice_id", 404);

  // Ignore callbacks for a voice that was reset for a new attempt, or that is
  // already finished. A late callback from a previous attempt must not create
  // stale publish rows.
  if (voice.status === "queued" || voice.status === "completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }
