export type ApiError = { error?: string; details?: unknown };

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => null)) as
    | (T & ApiError)
    | null;

  if (!response.ok) {
    throw new Error(
      data?.error ?? `Request failed with status ${response.status}`,
    );
  }
  return data as T;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}
