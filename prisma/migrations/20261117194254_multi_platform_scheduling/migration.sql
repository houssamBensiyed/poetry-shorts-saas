-- Multi-platform channels, per-destination Buffer posts, and remembered UTC
-- posting times. The old single `Channel.buffer_channel_id` is migrated into
-- the first ChannelDestination row before the column is dropped.

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('scheduled', 'publishing', 'published', 'failed');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'scheduled';
ALTER TYPE "JobStatus" ADD VALUE 'publishing';
ALTER TYPE "JobStatus" ADD VALUE 'partial';

-- AlterTable
ALTER TABLE "Channel"
ADD COLUMN     "buffer_organization_id" VARCHAR(100),
ADD COLUMN     "buffer_organization_name" VARCHAR(200),
ADD COLUMN     "language_group" VARCHAR(10) NOT NULL DEFAULT 'en';

-- Backfill the language group from the existing language code (fr-CA -> fr).
UPDATE "Channel"
SET "language_group" = lower(regexp_replace("language", '[-_].*$', ''));

UPDATE "Channel"
SET "language_group" = 'en'
WHERE "language_group" = '' OR "language_group" IS NULL;

-- AlterTable
ALTER TABLE "Voice" ADD COLUMN     "last_synced_at" TIMESTAMPTZ(3),
ADD COLUMN     "scheduled_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ChannelDestination" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "buffer_channel_id" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "service" VARCHAR(50) NOT NULL,
    "avatar" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_disconnected" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_queue_paused" BOOLEAN NOT NULL DEFAULT false,
    "youtube_category_id" VARCHAR(5),
    "last_synced_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelPostingTime" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language_group" VARCHAR(10) NOT NULL,
    "time_minutes" INTEGER NOT NULL,
    "use_count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelPostingTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicePublish" (
    "id" UUID NOT NULL,
    "voiceId" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "buffer_post_id" VARCHAR(200),
    "status" "PublishStatus" NOT NULL DEFAULT 'scheduled',
    "error_message" TEXT,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "external_url" TEXT,
    "last_synced_at" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicePublish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelDestination_channelId_idx" ON "ChannelDestination"("channelId");

-- CreateIndex
