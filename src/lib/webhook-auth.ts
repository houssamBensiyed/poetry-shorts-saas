import { timingSafeEqual } from "node:crypto";

/**
 * Optional shared-secret check for render/publish callbacks.
 *
 * When `WEBHOOK_SECRET` is set, callers must send it as `x-webhook-secret` (or
 * `Authorization: Bearer ...`). Leaving it unset keeps local development
 * working, but production deployments should always set it.
 */
export function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Fail closed in production: callbacks can change voice state, so an
    // unauthenticated endpoint must never be exposed there.
    return process.env.NODE_ENV !== "production";
  }

  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const provided = Buffer.from(header);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
