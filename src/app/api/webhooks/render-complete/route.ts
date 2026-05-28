import { NextResponse } from "next/server";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isHttpUrl, resolveLocalFile } from "@/lib/storage";
import { renderWebhookSchema } from "@/lib/validation";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export const dynamic = "force-dynamic";

/**
 * Callback from Project 02 (Render Engine) after a render attempt.
 * Idempotent: duplicate or stale callbacks are acknowledged but ignored.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = renderWebhookSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const voice = await prisma.voice.findUnique({
    where: { id: parsed.data.voice_id },
    select: {
      id: true,
      status: true,
      storage_mode: true,
      rendered_video_url: true,
    },
  });
  if (!voice) return jsonError("Unknown voice_id", 404);

  if (parsed.data.status === "rendered") {
    if (!parsed.data.video_url) {
      return jsonError("video_url is required when status is rendered", 422);
    }
    if (voice.storage_mode === "LOCAL") {
      try {
        await resolveLocalFile(parsed.data.video_url);
      } catch (error) {
        return jsonError(
          `The local reel is not reachable: ${errorMessage(error)}`,
          422,
        );
      }
    } else if (!isHttpUrl(parsed.data.video_url)) {
      return jsonError(
        "video_url must be an HTTP/HTTPS URL for remote voices",
        422,
      );
    }
