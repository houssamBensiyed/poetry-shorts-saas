import { NextResponse } from "next/server";

import { errorMessage, jsonError } from "@/lib/api";
import { isDefaultAvatar } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 300 * 1024;

function imageLooksValid(buffer: Buffer) {
  if (
    buffer.length > 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length > 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Save a built-in avatar or a browser-resized image. Custom images are capped
 * at 300 KB and checked by magic bytes before they reach the database.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Choose an avatar or upload an image", 422);
  }

  const preset = "preset" in body ? body.preset : undefined;
  const dataUrl = "dataUrl" in body ? body.dataUrl : undefined;

  if (dataUrl !== undefined) {
    if (typeof dataUrl !== "string") {
      return jsonError("The image is not valid", 422);
    }
    const match = DATA_URL.exec(dataUrl);
    if (!match) {
      return jsonError("Use a PNG, JPEG, or WebP image", 415);
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) {
      return jsonError("The image is empty", 422);
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return jsonError("The image must be 300 KB or smaller", 413);
    }
    const kind = imageLooksValid(buffer);
    if (!kind || kind !== match[1]) {
      return jsonError("The image file is not a valid PNG, JPEG, or WebP", 415);
    }
  } else if (typeof preset !== "string" || !isDefaultAvatar(preset)) {
    return jsonError("Choose one of the built-in avatars", 422);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar_url: (dataUrl as string | undefined) ?? (preset as string) },
    });
  } catch (error) {
    console.error("Avatar update failed", error);
    return jsonError(errorMessage(error), 500);
  }

  return NextResponse.json({ ok: true });
}

/** Restore the deterministic built-in avatar. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { avatar_url: null },
  });

  return NextResponse.json({ ok: true });
}
