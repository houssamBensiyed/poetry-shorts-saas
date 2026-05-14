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

  const credentials = {
    cloudName: parsed.data.cloud_name,
    apiKey: parsed.data.api_key,
    apiSecret,
  };

  const verification = await verifyCloudinaryCredentials(credentials);
  // Status 0 is a network failure. Save anyway and report the warning so a
  // temporary outage does not block the user.
  if (!verification.ok && verification.status !== 0) {
    return jsonError(verification.message, 422);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        cloudinary_cloud_name: credentials.cloudName,
        cloudinary_api_key: credentials.apiKey,
        cloudinary_api_secret: encryptToken(credentials.apiSecret),
      },
    });
  } catch (error) {
    console.error("Could not save Cloudinary credentials", error);
    return jsonError(errorMessage(error), 500);
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    verified: verification.ok,
    warning: verification.ok ? null : verification.message,
  });
}

/** Remove the account. Uploads that need Cloudinary will ask for it again. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      cloudinary_cloud_name: null,
      cloudinary_api_key: null,
      cloudinary_api_secret: null,
    },
  });

  return NextResponse.json({ ok: true, configured: false });
}
