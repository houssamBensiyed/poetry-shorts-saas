/**
 * Server-only client for Project 03 (Buffer upload service).
 * The Buffer token never reaches the browser; it is only forwarded here.
 */

export class UploaderError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "UploaderError";
    this.statusCode = statusCode;
  }
}

function uploaderConfig() {
  const url = (process.env.UPLOAD_SERVICE_URL ?? "http://localhost:8001").replace(
    /\/$/,
    "",
  );
  const key = process.env.UPLOAD_SERVICE_API_KEY ?? "";
  return { url, key };
}

const REQUEST_TIMEOUT_MS = Number(
  process.env.UPLOAD_SERVICE_TIMEOUT_MS ?? 60_000,
);

async function uploaderFetch<T>(path: string, body: unknown): Promise<T> {
  const { url, key } = uploaderConfig();

  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-api-key": key } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new UploaderError(
      `The Buffer service is not reachable: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  const text = await response.text().catch(() => "");
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new UploaderError(
        "The Buffer service rejected the service API key",
        502,
      );
    }
    const statusCode =
      response.status >= 400 && response.status < 500
        ? response.status
        : 502;
    throw new UploaderError(
      data?.error ??
        `The Buffer service responded with HTTP ${response.status}`,
      statusCode,
    );
  }

  if (!data) {
    throw new UploaderError("The Buffer service returned an empty response");
  }

  return data;
}

export type RemoteOrganization = { id: string; name: string };
