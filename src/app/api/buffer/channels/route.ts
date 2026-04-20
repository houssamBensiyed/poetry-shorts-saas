import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, validationError } from "@/lib/api";
import { resolveBufferToken } from "@/lib/buffer-token";
import { getSessionUser } from "@/lib/session";
import { fetchPlatformDestinations, UploaderError } from "@/lib/uploader";

export const dynamic = "force-dynamic";

const schema = z.object({
  organization_id: z.string().trim().min(1).max(100),
  buffer_access_token: z.string().trim().min(1).max(4000).optional(),
  channelId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const resolved = await resolveBufferToken({ userId: user.id, ...parsed.data });
  if ("error" in resolved) return resolved.error;

  try {
    const channels = await fetchPlatformDestinations(
      resolved.token,
      parsed.data.organization_id,
    );
    return NextResponse.json({ channels });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reach Buffer";
    return jsonError(
      message,
      error instanceof UploaderError ? error.statusCode : 502,
    );
  }
}
