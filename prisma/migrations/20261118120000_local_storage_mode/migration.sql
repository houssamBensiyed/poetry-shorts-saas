-- Per-user local/remote storage. Existing users and voices stay on Cloudinary.
-- LOCAL voices keep their audio and rendered reel in a folder shared with the
-- render engine; buffer_video_url holds the Cloudinary copy needed by Buffer.

-- CreateEnum
CREATE TYPE "StorageMode" AS ENUM ('LOCAL', 'REMOTE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "storage_mode" "StorageMode" NOT NULL DEFAULT 'REMOTE';

-- AlterTable
ALTER TABLE "Voice"
ADD COLUMN "storage_mode" "StorageMode" NOT NULL DEFAULT 'REMOTE',
ADD COLUMN "buffer_video_url" TEXT;
