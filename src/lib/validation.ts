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
