import { z } from "zod";

// Error messages are translation keys under "auth.errors" so every language
// shows its own wording. The same rules run in the browser and on the server.

export const TERMS_VERSION = "2026-10-18";

// Matches supabase/config.toml: minimum_password_length and
// password_requirements = "lower_upper_letters_digits".
export const PASSWORD_MIN = 10;
const PASSWORD_MAX = 72; // bcrypt ignores anything longer

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("emailInvalid").max(254, "emailInvalid"));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "passwordWeak")
  .max(PASSWORD_MAX, "passwordTooLong")
  .regex(/[a-z]/, "passwordWeak")
  .regex(/[A-Z]/, "passwordWeak")
  .regex(/[0-9]/, "passwordWeak");

/**
 * Turns what people type into E.164 (+15551234567). Ten digits are read as a
 * US number; anything else must already include its country code.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

/** Whole years between a YYYY-MM-DD birthdate and today (UTC). */
export function ageOn(birthdate: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() < mo - 1 ||
    (today.getUTCMonth() === mo - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

// A checked box submits "on"; an unchecked one submits nothing.
const checkbox = z
  .string()
  .nullish()
  .transform((v) => v === "on" || v === "true");

export const signUpSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  phone: z.string().transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  }),
  birthdate: z.string().superRefine((v, ctx) => {
    const age = ageOn(v);
    if (age === null || age > 120) {
      ctx.addIssue({ code: "custom", message: "birthdateInvalid" });
    } else if (age < 18) {
      ctx.addIssue({ code: "custom", message: "underage" });
    }
  }),
  acceptTerms: checkbox.refine((v) => v, "termsRequired"),
  marketingEmails: checkbox,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "passwordRequired"),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export const otpTypes = [
  "email",
  "signup",
  "recovery",
  "email_change",
] as const;
export type OtpType = (typeof otpTypes)[number];

export const confirmSchema = z.object({
  token_hash: z.string().min(8).max(512),
  type: z.enum(otpTypes),
  next: z.string().optional(),
});

/** First error per field, as translation keys. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
