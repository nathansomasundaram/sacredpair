import { z } from "zod";
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_PROMPTS,
  MULTI_CHOICE,
  MULTI_MAX,
  PROFESSION_MAX,
  PROMPT_ANSWER_MAX,
  PROMPTS,
  SINGLE_CHOICE,
  type MultiChoiceField,
  type PromptCode,
  type SingleChoiceField,
} from "./premium-options";

// Messages are translation keys under "premium.errors".

const singles = Object.fromEntries(
  Object.entries(SINGLE_CHOICE).map(([field, codes]) => [
    field,
    z
      .union(
        [z.literal(""), z.enum(codes as unknown as [string, ...string[]])],
        {
          message: "unknownChoice",
        },
      )
      .transform((v) => (v === "" ? null : v)),
  ]),
) as unknown as Record<SingleChoiceField, z.ZodType<string | null, string>>;

const multis = Object.fromEntries(
  Object.entries(MULTI_CHOICE).map(([field, codes]) => [
    field,
    z
      .array(z.enum(codes as unknown as [string, ...string[]]), {
        message: "unknownChoice",
      })
      .transform((list) => [...new Set(list)])
      .pipe(
        z
          .array(z.string())
          .max(MULTI_MAX[field as MultiChoiceField], "tooManyChoices"),
      ),
  ]),
) as unknown as Record<MultiChoiceField, z.ZodType<string[], string[]>>;

/** Feet and inches (US) or centimetres, to whole centimetres. Empty means not shared. */
export function heightToCm(input: {
  feet?: string;
  inches?: string;
  cm?: string;
}): number | null | "invalid" {
  if (input.cm !== undefined && input.cm !== "") {
    const cm = Number(input.cm);
    return Number.isInteger(cm) ? cm : "invalid";
  }
  // No feet chosen means height isn't shared (inches alone mean nothing).
  if (!input.feet) return null;
  const feet = Number(input.feet || 0);
  const inches = Number(input.inches || 0);
  if (
    !Number.isInteger(feet) ||
    !Number.isInteger(inches) ||
    inches < 0 ||
    inches > 11
  ) {
    return "invalid";
  }
  return Math.round((feet * 12 + inches) * 2.54);
}

/** Centimetres to feet and inches for display. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / 2.54);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

const promptSchema = z.object({
  prompt: z.enum(PROMPTS, { message: "unknownChoice" }),
  answer: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, "answerRequired")
        .max(PROMPT_ANSWER_MAX, "answerTooLong"),
    ),
});

export const premiumDetailsSchema = z
  .object({
    height: z.object({
      feet: z.string().optional(),
      inches: z.string().optional(),
      cm: z.string().optional(),
    }),
    profession: z
      .string()
      .transform((v) => v.replace(/\s+/g, " ").trim())
      .pipe(z.string().max(PROFESSION_MAX, "professionTooLong"))
      .transform((v) => v || null),
    prompts: z
      .array(z.object({ prompt: z.string(), answer: z.string() }))
      // A row with neither a prompt nor an answer is simply unused.
      .transform((rows) =>
        rows.filter((r) => r.prompt !== "" || r.answer.trim() !== ""),
      )
      .pipe(z.array(promptSchema).max(MAX_PROMPTS, "tooManyPrompts"))
      .refine(
        (rows) => new Set(rows.map((r) => r.prompt)).size === rows.length,
        "promptRepeated",
      ),
    ...singles,
    ...multis,
  })
  .transform((v, ctx) => {
    const cm = heightToCm(v.height);
    if (
      cm === "invalid" ||
      (cm !== null && (cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["height"],
        message: "heightOutOfRange",
      });
      return z.NEVER;
    }
    const { height: _height, ...rest } = v;
    void _height;
    return { ...rest, heightCm: cm };
  });

export type PremiumDetailsInput = z.input<typeof premiumDetailsSchema>;
export type PremiumDetails = z.output<typeof premiumDetailsSchema>;
export type PromptAnswer = { prompt: PromptCode; answer: string };

/** Reads the editor's form fields into the shape the schema expects. */
export function premiumFormToInput(form: FormData): PremiumDetailsInput {
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const prompts = Array.from({ length: MAX_PROMPTS }, (_, i) => ({
    prompt: text(`prompt_${i + 1}`),
    answer: text(`answer_${i + 1}`),
  }));
  const input: Record<string, unknown> = {
    height: {
      feet: form.has("heightFeet") ? text("heightFeet") : undefined,
      inches: form.has("heightInches") ? text("heightInches") : undefined,
      cm: form.has("heightCm") ? text("heightCm") : undefined,
    },
    profession: text("profession"),
    prompts,
  };
  for (const field of Object.keys(SINGLE_CHOICE)) input[field] = text(field);
  for (const field of Object.keys(MULTI_CHOICE)) {
    input[field] = form
      .getAll(field)
      .filter((v): v is string => typeof v === "string");
  }
  return input as PremiumDetailsInput;
}
