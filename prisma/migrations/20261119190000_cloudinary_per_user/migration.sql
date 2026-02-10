-- Per-user Cloudinary account. The API secret is encrypted with AES-256-GCM.
ALTER TABLE "User"
  ADD COLUMN "cloudinary_cloud_name" VARCHAR(100),
  ADD COLUMN "cloudinary_api_key" VARCHAR(200),
  ADD COLUMN "cloudinary_api_secret" TEXT;
