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

export type RemoteDestination = {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  avatar: string | null;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
};

export type RemotePublishResult = {
  buffer_channel_id: string;
  buffer_post_id?: string | null;
  status: "scheduled" | "publishing" | "published" | "failed";
  error?: string | null;
};

export type RemoteStatusResult = {
  buffer_post_id: string;
  // null means Project 03 could not read the status (network or token error).
  status: "scheduled" | "publishing" | "published" | "failed" | null;
  buffer_status?: string | null;
  due_at?: string | null;
  published_at?: string | null;
  external_url?: string | null;
  error?: string | null;
};

export async function fetchOrganizations(token: string) {
  const data = await uploaderFetch<{ organizations: RemoteOrganization[] }>(
    "/api/v1/buffer/organizations",
    { buffer_access_token: token },
  );
  return data.organizations ?? [];
}

export async function fetchPlatformDestinations(
  token: string,
  organizationId: string,
) {
  const data = await uploaderFetch<{ channels: RemoteDestination[] }>(
    "/api/v1/buffer/channels",
    { buffer_access_token: token, organization_id: organizationId },
  );
  return data.channels ?? [];
}

export type PublishDestinationPayload = {
  buffer_channel_id: string;
  service: string;
  youtube_category_id?: string | null;
};

export async function publishVoice(options: {
  token: string;
  voiceId: string;
  videoUrl: string;
  title: string;
  description: string;
  scheduledAt: Date;
  destinations: PublishDestinationPayload[];
  callbackUrl?: string;
}) {
  return uploaderFetch<{
    voice_id: string;
    status: string;
    results: RemotePublishResult[];
  }>("/api/v1/publish", {
    voice_id: options.voiceId,
    video_url: options.videoUrl,
    title: options.title,
    description: options.description,
    scheduled_at: options.scheduledAt.toISOString(),
    buffer_access_token: options.token,
    destinations: options.destinations,
    ...(options.callbackUrl ? { callback_url: options.callbackUrl } : {}),
  });
}

export async function fetchPostStatuses(token: string, postIds: string[]) {
  const data = await uploaderFetch<{ results: RemoteStatusResult[] }>(
    "/api/v1/publish/status",
    { buffer_access_token: token, buffer_post_ids: postIds },
  );
  return data.results ?? [];
}
