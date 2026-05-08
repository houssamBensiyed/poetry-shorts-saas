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
