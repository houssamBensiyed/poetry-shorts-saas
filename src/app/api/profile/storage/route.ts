import { NextResponse } from "next/server";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { localMediaRoot } from "@/lib/storage";
import { profileStorageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Change where this user's future voices are stored. Existing voices keep the
 * mode captured at upload time.
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = profileStorageSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.storage_mode === "LOCAL") {
    try {
      localMediaRoot();
    } catch (error) {
      return jsonError(errorMessage(error), 503);
    }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { storage_mode: parsed.data.storage_mode },
    });
  } catch (error) {
    console.error("Storage preference update failed", error);
    return jsonError(errorMessage(error), 500);
  }

  return NextResponse.json({
    ok: true,
    storage_mode: parsed.data.storage_mode,
  });
}
