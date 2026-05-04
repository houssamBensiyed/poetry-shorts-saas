import { NextResponse } from "next/server";

import { jsonError, validationError } from "@/lib/api";
import { formatLanguageGroup, normalizeLanguageGroup } from "@/lib/language";
import {
  listPostingTimes,
  publicPostingTime,
  recordPostingTime,
} from "@/lib/posting-times";
import { getSessionUser } from "@/lib/session";
import { timeToMinutes } from "@/lib/time";
import { postingTimeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") ?? undefined;
  if (group && group.length > 10) return jsonError("Invalid group", 400);

  const times = await listPostingTimes(user.id, group ?? undefined);
  const language_group = group ? normalizeLanguageGroup(group) : null;

  return NextResponse.json({
    language_group,
    label: language_group ? formatLanguageGroup(language_group) : null,
    times,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = postingTimeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const minutes = timeToMinutes(parsed.data.time);
  if (minutes === null) return jsonError("Invalid UTC time", 422);

  const time = await recordPostingTime(user.id, parsed.data.group, minutes);
  return NextResponse.json({ time: publicPostingTime(time) }, { status: 201 });
}
