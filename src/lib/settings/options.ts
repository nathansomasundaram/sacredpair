// Choices on the Settings pages. Stored as codes; labels come from
// messages (options.<field>.<code>), the same as on profiles.
import { MULTI_CHOICE, SINGLE_CHOICE } from "@/lib/profile/premium-options";

export const GENDERS = ["man", "woman", "non_binary"] as const;
export type Gender = (typeof GENDERS)[number];

export const AGE_MIN = 18;
export const AGE_MAX = 99;

/** Distance limits in kilometers (stored metric); 5000 means anywhere. */
export const ANYWHERE_KM = 5000;
export const RADIUS_KM = [16, 40, 80, 161, 402, ANYWHERE_KM] as const;
export const DEFAULT_RADIUS_KM = 80;

/** The closest offered distance to a stored value. */
export const nearestRadius = (km: number) =>
  RADIUS_KM.reduce(
    (best, r) => (Math.abs(r - km) < Math.abs(best - km) ? r : best),
    RADIUS_KM[0],
  );

/**
 * Premium filters: "show only these". "Prefer not to say" and "allergic"
 * aren't something to filter for.
 */
export const FILTERS = {
  religion: SINGLE_CHOICE.religion.filter((c) => c !== "prefer_not"),
  ethnicity: SINGLE_CHOICE.ethnicity.filter((c) => c !== "prefer_not"),
  family_plan: [...SINGLE_CHOICE.family_plan],
  smoking: [...SINGLE_CHOICE.smoking],
  drinking: [...SINGLE_CHOICE.drinking],
  pets: MULTI_CHOICE.pets.filter((c) => c !== "allergic"),
} as const;

export type FilterField = keyof typeof FILTERS;
export const FILTER_FIELDS = Object.keys(FILTERS) as FilterField[];
