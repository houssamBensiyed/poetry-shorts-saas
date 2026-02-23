import { z } from "zod";

import { JOB_STATUSES, REEL_STYLES } from "@/lib/types";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

const tokenSchema = z
  .string()
  .trim()
  .min(1, "Enter a Buffer access token")
  .max(4000, "Buffer access token is too long");

const languageSchema = z
  .string()
  .trim()
  .min(2, "Use a language code such as en or fr-CA")
  .max(20)
  .regex(
    /^[a-zA-Z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/,
    "Use a short language code such as en, fr, or pt-BR",
  );

const utcDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20");

const utcTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a UTC time like 18:30");

export const destinationInputSchema = z.object({
  buffer_channel_id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  service: z.string().trim().min(1).max(50),
  avatar: z.string().trim().max(2000).nullish(),
  enabled: z.boolean().default(true),
  youtube_category_id: z.string().trim().max(5).nullish(),
});

export const channelCreateSchema = z.object({
  name: z.string().trim().min(1, "Channel name is required").max(80),
  language: languageSchema.default("en"),
  reel_style: z.enum(REEL_STYLES).default("A"),
  aspect_ratio: z.literal("9:16").default("9:16"),
  enabled: z.boolean().default(true),
  buffer_access_token: tokenSchema,
  buffer_organization_id: z.string().trim().max(100).nullish(),
  buffer_organization_name: z.string().trim().max(200).nullish(),
  destinations: z
    .array(destinationInputSchema)
    .min(1, "Select at least one Buffer destination")
    .max(20),
});

export const channelUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  language: languageSchema.optional(),
  reel_style: z.enum(REEL_STYLES).optional(),
  enabled: z.boolean().optional(),
  buffer_access_token: z.string().trim().max(4000).optional(),
  buffer_organization_id: z.string().trim().max(100).nullish(),
  buffer_organization_name: z.string().trim().max(200).nullish(),
  destinations: z
    .array(destinationInputSchema)
    .min(1, "Select at least one Buffer destination")
    .max(20)
    .optional(),
});

export const postingTimeSchema = z.object({
  group: z.string().trim().min(2).max(10),
  time: utcTimeSchema,
});

export const storageModeSchema = z.enum(["LOCAL", "REMOTE"]);

export const voiceMetadataSchema = z.object({
  channelId: z.string().uuid("Choose a channel"),
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().trim().max(5000).default(""),
  storage_mode: storageModeSchema.optional(),
  upload_to_buffer: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true"),
  reel_style: z.enum(REEL_STYLES).optional(),
  scheduled_date: utcDateSchema.optional(),
  scheduled_time: utcTimeSchema.optional(),
});

export const scheduleUpdateSchema = z.object({
  scheduled_date: utcDateSchema,
  scheduled_time: utcTimeSchema,
});

export const voiceStatusSchema = z.enum(JOB_STATUSES);

export const profileStorageSchema = z.object({
  storage_mode: storageModeSchema,
});

export const profileNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(80, "Keep the name under 80 characters"),
});

export const cloudinaryCredentialsSchema = z.object({
  cloud_name: z
    .string()
    .trim()
    .min(1, "Enter your Cloudinary cloud name")
    .max(100)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Use the cloud name only, not a URL",
    ),
  api_key: z
    .string()
    .trim()
    .min(1, "Enter your Cloudinary API key")
    .max(200),
  // Empty keeps the stored secret when one already exists.
  api_secret: z.string().trim().max(400).optional().default(""),
});

export const renderWebhookSchema = z.object({
  voice_id: z.string().uuid(),
  status: z.enum(["rendered", "failed"]),
  // A Cloudinary URL in remote mode, an absolute path in local mode. The route
  // validates it against the voice's storage mode before saving.
  video_url: z.string().trim().min(1).nullable().optional(),
  duration_seconds: z.number().nonnegative().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const publishResultSchema = z.object({
  buffer_channel_id: z.string().trim().min(1).max(200),
  buffer_post_id: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["scheduled", "publishing", "published", "failed"]),
  error: z.string().nullable().optional(),
});

export const publishWebhookSchema = z.object({
  voice_id: z.string().uuid(),
  status: z
    .enum(["scheduled", "publishing", "partial", "published", "failed"])
    .optional(),
  buffer_post_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  results: z.array(publishResultSchema).max(20).optional(),
});

export const retryVoiceSchema = z.object({
  createRun: z.boolean().default(true),
});
