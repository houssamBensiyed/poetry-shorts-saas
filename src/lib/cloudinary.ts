import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

const FOLDER = "poetry-shorts/voices";
const VIDEO_FOLDER = "poetry-shorts/reels";
const VERIFY_TIMEOUT_MS = 10_000;

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type CloudinaryVerification =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Per-call account settings. The Cloudinary Node SDK resolves these before the
 * global config, so concurrent users never share credentials.
 */
function accountOptions(credentials: CloudinaryCredentials) {
  return {
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true,
  };
}

export type UploadedAudio = {
  url: string;
  publicId: string;
  duration: number | null;
};

/** Upload a user recording to that user's Cloudinary account. */
export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  credentials: CloudinaryCredentials,
): Promise<UploadedAudio> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...accountOptions(credentials),
        resource_type: "video",
        folder: FOLDER,
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
        overwrite: false,
      },
      (error, response) => {
        if (error || !response) {
          reject(error ?? new Error("Cloudinary returned no upload result"));
          return;
        }
        resolve(response);
      },
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    duration: typeof result.duration === "number" ? result.duration : null,
  };
}

/**
 * Upload a locally rendered reel to the owner's Cloudinary account so Buffer has
 * a public URL. Local mode only uses this at publish time; the local file stays
 * the primary copy and is still what the SaaS serves for preview and download.
 */
export async function uploadVideo(
  filePath: string,
  voiceId: string,
  credentials: CloudinaryCredentials,
): Promise<string> {
  const result = await cloudinary.uploader.upload(filePath, {
    ...accountOptions(credentials),
    resource_type: "video",
    folder: VIDEO_FOLDER,
    public_id: voiceId,
    overwrite: true,
    invalidate: true,
  });
  if (
    typeof result.secure_url !== "string" ||
    !result.secure_url.startsWith("https://")
  ) {
    throw new Error("Cloudinary did not return a secure video URL");
  }
  return result.secure_url;
}

/**
 * Check the account before saving it. A 401 means the key or secret is wrong and
 * a 404 means the cloud name does not exist. A 403 means the credentials are
 * valid but the key is restricted and may not read the Admin API, so it is
 * accepted. Network failures return status 0 and let the caller save with a
 * warning instead of blocking on a transient outage.
 */
export async function verifyCloudinaryCredentials(
  credentials: CloudinaryCredentials,
): Promise<CloudinaryVerification> {
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    credentials.cloudName,
  )}/resources/video?max_results=1`;
  const authorization = `Basic ${Buffer.from(
    `${credentials.apiKey}:${credentials.apiSecret}`,
  ).toString("base64")}`;

  try {
    const response = await fetch(url, {
      headers: { authorization },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    if (response.ok || response.status === 403) return { ok: true };
    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        message: "Cloudinary rejected the API key or API secret.",
      };
    }
    if (response.status === 404) {
      return {
        ok: false,
        status: 404,
        message: "Cloudinary could not find that cloud name.",
      };
    }
    return {
      ok: false,
      status: response.status,
      message: `Cloudinary responded with HTTP ${response.status}.`,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message:
        "The credentials were saved, but Cloudinary could not be reached to verify them.",
    };
  }
}
