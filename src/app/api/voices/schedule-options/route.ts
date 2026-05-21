import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api";
import { buildScheduleOptions } from "@/lib/posting-times";
import { getSessionUser } from "@/lib/session";
import { todayUtcKey, utcDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const date = searchParams.get("date") ?? todayUtcKey();

  if (!channelId || !z.string().uuid().safeParse(channelId).success) {
    return jsonError("Choose a channel", 400);
  }
  if (!dateSchema.safeParse(date).success) {
    return jsonError("Use a date like 2026-11-20", 400);
  }
  if (!utcDateTime(date, "00:00")) {
    return jsonError("Use a real date like 2026-11-20", 400);
  }

  const options = await buildScheduleOptions({
    userId: user.id,
    channelId,
    date,
  });
  if (!options) return jsonError("Channel not found", 404);

  return NextResponse.json(options);
}
