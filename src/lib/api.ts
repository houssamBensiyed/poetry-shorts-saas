import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: "Please check the submitted values",
      details: error.flatten(),
    },
    { status: 422 },
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reject malformed ids before Prisma turns them into a 500. */
export function isUuid(value: string) {
  return UUID_RE.test(value);
}
