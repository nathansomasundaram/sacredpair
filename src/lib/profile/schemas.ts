import { z } from "zod";
import {
  ABOUT_MAX,
  CITY_MAX,
  MAX_TRAITS,
  NAME_MAX,
  TRAITS,
  US_STATES,
} from "./options";

// Messages are translation keys under "profile.errors".

/** Collapses runs of spaces and trims, so "  Mary   Ann " becomes "Mary Ann". */
const tidy = (v: string) => v.replace(/\s+/g, " ").trim();

export const profileOverviewSchema = z.object({
  displayName: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(1, "nameRequired").max(NAME_MAX, "nameTooLong")),
  city: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(1, "cityRequired").max(CITY_MAX, "cityTooLong")),
  stateCode: z.enum(US_STATES, { message: "stateRequired" }),
  // Keeps the member's line breaks; only trims the ends.
  aboutMe: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(ABOUT_MAX, "aboutTooLong")),
  traits: z
    .array(z.enum(TRAITS))
    .transform((list) => [...new Set(list)])
    .pipe(z.array(z.enum(TRAITS)).max(MAX_TRAITS, "tooManyTraits")),
});

export type ProfileOverviewInput = z.infer<typeof profileOverviewSchema>;
