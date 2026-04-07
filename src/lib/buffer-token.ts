import { jsonError } from "@/lib/api";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the Buffer token for a discovery request. The browser may send a new
 * token while editing, or the channel can use the token already stored (still
 * encrypted). The token is never returned to the browser.
 */
export async function resolveBufferToken(input: {
  userId: string;
  buffer_access_token?: string | null;
  channelId?: string | null;
}) {
  if (input.buffer_access_token?.trim()) {
    return { token: input.buffer_access_token.trim(), channel: null };
  }

  if (!input.channelId) {
    return { error: jsonError("Enter a Buffer access token", 422) };
  }

  const channel = await prisma.channel.findFirst({
    where: { id: input.channelId, userId: input.userId },
    select: {
      id: true,
      buffer_access_token: true,
      buffer_organization_id: true,
      buffer_organization_name: true,
    },
  });
  if (!channel) return { error: jsonError("Channel not found", 404) };

  try {
    return { token: decryptToken(channel.buffer_access_token), channel };
  } catch {
    return {
      error: jsonError(
        "The stored Buffer token cannot be decrypted. Enter it again.",
        409,
      ),
    };
  }
}
