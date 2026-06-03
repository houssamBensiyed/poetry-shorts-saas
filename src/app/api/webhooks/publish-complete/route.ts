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

  if (parsed.data.results?.length) {
    const status = await recordPublishResults(voice.id, parsed.data.results);
    return NextResponse.json({ ok: true, status });
  }

  if (!parsed.data.status) {
    return jsonError("Provide `results` or `status`", 422);
  }
  if (parsed.data.status === "partial") {
    return jsonError(
      "Partial publishes must include per-destination `results`.",
      422,
    );
  }
  // Legacy single-result callback: only meaningful when the voice has exactly
  // one destination. With several, one result cannot describe all of them.
  if (voice.publishes.length === 0) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (voice.publishes.length > 1) {
    return jsonError(
      "This voice has multiple destinations. Send per-destination `results`.",
      422,
    );
  }

  const status = await recordPublishResults(
    voice.id,
    voice.publishes.map((publish) => ({
      buffer_channel_id: publish.destination.buffer_channel_id,
      buffer_post_id: parsed.data.buffer_post_id ?? null,
      status:
        parsed.data.status === "publishing"
          ? "publishing"
          : parsed.data.status === "scheduled"
            ? "scheduled"
            : parsed.data.status === "published"
              ? "published"
              : "failed",
      error: parsed.data.error ?? null,
    })),
  );

  return NextResponse.json({ ok: true, status });
}
