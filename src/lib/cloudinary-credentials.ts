import type { CloudinaryCredentials } from "@/lib/cloudinary";
import { decryptToken } from "@/lib/crypto";

/** Columns that hold a user's Cloudinary account. */
export const cloudinaryUserSelect = {
  cloudinary_cloud_name: true,
  cloudinary_api_key: true,
  cloudinary_api_secret: true,
} as const;

export type CloudinaryUser = {
  cloudinary_cloud_name: string | null;
  cloudinary_api_key: string | null;
  cloudinary_api_secret: string | null;
};

export function isCloudinaryConfigured(user: CloudinaryUser | null) {
  return Boolean(
    user?.cloudinary_cloud_name &&
      user.cloudinary_api_key &&
      user.cloudinary_api_secret,
  );
}

/**
 * Decrypt the stored secret and return usable credentials. Returns null when
 * the account is incomplete or the stored secret cannot be decrypted (for
 * example after the encryption key changed).
 */
export function resolveCloudinaryCredentials(
  user: CloudinaryUser | null,
): CloudinaryCredentials | null {
  const cloudName = user?.cloudinary_cloud_name;
  const apiKey = user?.cloudinary_api_key;
  const encryptedSecret = user?.cloudinary_api_secret;
  if (!cloudName || !apiKey || !encryptedSecret) return null;

  try {
    const apiSecret = decryptToken(encryptedSecret);
    if (!apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}
