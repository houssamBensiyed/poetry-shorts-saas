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
