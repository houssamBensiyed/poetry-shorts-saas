import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorMessage, jsonError, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { profileNameSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  try {
    const body = await request.json().catch(() => null);

    // The same endpoint handles the display name and password changes. A body
    // with `name` is a profile edit; otherwise it must be a password change.
    if (body && typeof body === "object" && "name" in body) {
      const parsedName = profileNameSchema.safeParse(body);
      if (!parsedName.success) return validationError(parsedName.error);

      await prisma.user.update({
        where: { id: user.id },
        data: { name: parsedName.data.name },
      });

      return NextResponse.json({ ok: true, name: parsedName.data.name });
    }

    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record) return jsonError("Account not found", 404);

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      record.passwordHash,
    );
    if (!valid) return jsonError("Current password is incorrect", 403);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile update failed", error);
    return jsonError(errorMessage(error), 500);
  }
}
