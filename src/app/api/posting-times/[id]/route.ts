import { NextResponse } from "next/server";

import { isUuid, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Posting time not found", 404);

  const time = await prisma.channelPostingTime.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!time) return jsonError("Posting time not found", 404);

  await prisma.channelPostingTime.delete({ where: { id: time.id } });
  return NextResponse.json({ ok: true });
}
