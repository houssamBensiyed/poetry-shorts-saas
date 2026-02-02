-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'rendered', 'submitting', 'published', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ReelStyle" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "reel_style" "ReelStyle" NOT NULL DEFAULT 'A',
    "aspect_ratio" VARCHAR(10) NOT NULL DEFAULT '9:16',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "buffer_channel_id" VARCHAR(200) NOT NULL,
    "buffer_access_token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueRun" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'processing',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "completed_items" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "queueRunId" UUID,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "audio_url" TEXT NOT NULL,
    "upload_to_buffer" BOOLEAN NOT NULL DEFAULT true,
    "reel_style" "ReelStyle" NOT NULL DEFAULT 'A',
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "rendered_video_url" TEXT,
    "duration_seconds" DOUBLE PRECISION,
    "buffer_post_id" VARCHAR(200),
    "error_message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Channel_userId_idx" ON "Channel"("userId");

-- CreateIndex
CREATE INDEX "QueueRun_userId_status_idx" ON "QueueRun"("userId", "status");

-- CreateIndex
CREATE INDEX "Voice_userId_status_idx" ON "Voice"("userId", "status");

-- CreateIndex
CREATE INDEX "Voice_channelId_idx" ON "Voice"("channelId");

-- CreateIndex
CREATE INDEX "Voice_queueRunId_idx" ON "Voice"("queueRunId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueRun" ADD CONSTRAINT "QueueRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voice" ADD CONSTRAINT "Voice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voice" ADD CONSTRAINT "Voice_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voice" ADD CONSTRAINT "Voice_queueRunId_fkey" FOREIGN KEY ("queueRunId") REFERENCES "QueueRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

