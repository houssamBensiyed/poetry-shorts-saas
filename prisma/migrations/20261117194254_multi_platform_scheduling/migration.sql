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
CREATE UNIQUE INDEX "ChannelDestination_channelId_buffer_channel_id_key" ON "ChannelDestination"("channelId", "buffer_channel_id");

-- CreateIndex
CREATE INDEX "ChannelPostingTime_userId_language_group_last_used_at_idx" ON "ChannelPostingTime"("userId", "language_group", "last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPostingTime_userId_language_group_time_minutes_key" ON "ChannelPostingTime"("userId", "language_group", "time_minutes");

-- CreateIndex
CREATE INDEX "VoicePublish_status_scheduled_at_idx" ON "VoicePublish"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "VoicePublish_voiceId_idx" ON "VoicePublish"("voiceId");

-- CreateIndex
CREATE UNIQUE INDEX "VoicePublish_voiceId_destinationId_key" ON "VoicePublish"("voiceId", "destinationId");

-- CreateIndex
CREATE INDEX "Channel_userId_language_group_idx" ON "Channel"("userId", "language_group");

-- CreateIndex
CREATE INDEX "Voice_status_scheduled_at_idx" ON "Voice"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "ChannelDestination" ADD CONSTRAINT "ChannelDestination_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPostingTime" ADD CONSTRAINT "ChannelPostingTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicePublish" ADD CONSTRAINT "VoicePublish_voiceId_fkey" FOREIGN KEY ("voiceId") REFERENCES "Voice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicePublish" ADD CONSTRAINT "VoicePublish_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "ChannelDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: one old Buffer channel becomes the first destination.
INSERT INTO "ChannelDestination" (
    "id", "channelId", "buffer_channel_id", "name", "service", "enabled",
    "is_disconnected", "is_locked", "is_queue_paused", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    "id",
    "buffer_channel_id",
    "name",
    'unknown',
    true,
    false,
    false,
    false,
    now(),
    now()
FROM "Channel"
WHERE "buffer_channel_id" IS NOT NULL AND btrim("buffer_channel_id") <> '';

-- Migrate existing data: old voice post IDs become per-destination publish rows.
INSERT INTO "VoicePublish" (
    "id", "voiceId", "destinationId", "buffer_post_id", "status",
    "scheduled_at", "published_at", "last_synced_at", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    v."id",
    d."id",
    v."buffer_post_id",
    CASE
        WHEN v."status" = 'published' THEN 'published'::"PublishStatus"
        ELSE 'scheduled'::"PublishStatus"
    END,
    COALESCE(v."scheduled_at", v."createdAt"),
    CASE WHEN v."status" = 'published' THEN v."updatedAt" ELSE NULL END,
    now(),
    now(),
    now()
FROM "Voice" v
JOIN "ChannelDestination" d ON d."id" = (
    SELECT "id"
    FROM "ChannelDestination"
    WHERE "channelId" = v."channelId"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
WHERE v."buffer_post_id" IS NOT NULL AND btrim(v."buffer_post_id") <> '';

-- AlterTable: the single Buffer channel ID now lives in ChannelDestination.
ALTER TABLE "Channel" DROP COLUMN "buffer_channel_id";
