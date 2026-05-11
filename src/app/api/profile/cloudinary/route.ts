import { NextResponse } from "next/server";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { verifyCloudinaryCredentials } from "@/lib/cloudinary";
import {
  cloudinaryUserSelect,
  isCloudinaryConfigured,
} from "@/lib/cloudinary-credentials";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { cloudinaryCredentialsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Return the current account without ever exposing the API secret. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: cloudinaryUserSelect,
  });

  return NextResponse.json({
    configured: isCloudinaryConfigured(record),
    cloud_name: record?.cloudinary_cloud_name ?? "",
    api_key: record?.cloudinary_api_key ?? "",
    has_secret: Boolean(record?.cloudinary_api_secret),
  });
}

/**
 * Save this user's Cloudinary account. The secret is encrypted at rest and the
 * account is verified before it is accepted. Leaving `api_secret` empty keeps
 * the stored secret, so the cloud name or key can be edited without retyping it.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = cloudinaryCredentialsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: cloudinaryUserSelect,
  });

  let apiSecret = parsed.data.api_secret;
  if (!apiSecret) {
    if (!record?.cloudinary_api_secret) {
      return jsonError("Enter your Cloudinary API secret", 422);
    }
    try {
      apiSecret = decryptToken(record.cloudinary_api_secret);
    } catch {
      return jsonError(
        "The stored Cloudinary secret cannot be decrypted. Enter it again.",
        409,
      );
    }
  }
