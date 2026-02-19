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
