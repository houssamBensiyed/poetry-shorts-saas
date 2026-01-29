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
