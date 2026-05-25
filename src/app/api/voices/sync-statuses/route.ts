import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { syncPublishStatuses } from "@/lib/sync";
import { publicVoices, voiceInclude } from "@/lib/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called when the voices page opens, by the periodic refresh, and by the manual
 * "Refresh statuses" button. `force=1` also checks posts scheduled for later.
 *
 * The response uses the same shape as `GET /api/voices`, because the client
 * replaces its full voice list with this payload.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const force = ["1", "true", "yes"].includes(
    (searchParams.get("force") ?? "").toLowerCase(),
  );

  try {
    const summary = await syncPublishStatuses({ userId: user.id, force });
    const voices = await prisma.voice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: voiceInclude,
    });

    return NextResponse.json({ summary, voices: publicVoices(voices) });
  } catch (error) {
    console.error("Status sync failed", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not refresh statuses",
      502,
    );
  }
}
