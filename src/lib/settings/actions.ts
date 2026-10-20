"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getMembership } from "@/lib/premium/data";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { locateZip } from "./location";
import {
  AGE_MAX,
  AGE_MIN,
  FILTER_FIELDS,
  FILTERS,
  GENDERS,
  RADIUS_KM,
} from "./options";

export type SaveState = {
  saved?: boolean;
  error?: "ages" | "zip" | "failed";
  /** Filters weren't saved because the member isn't Premium. */
  filtersSkipped?: boolean;
};

const preferencesSchema = z
  .object({
    gender: z.enum(GENDERS).nullable(),
    lookingFor: z.array(z.enum(GENDERS)),
    ageMin: z.coerce.number().int().min(AGE_MIN).max(AGE_MAX),
    ageMax: z.coerce.number().int().min(AGE_MIN).max(AGE_MAX),
    radiusKm: z.coerce
      .number()
      .refine((n) => (RADIUS_KM as readonly number[]).includes(n)),
    zip: z
      .string()
      .trim()
      .regex(/^(\d{5})?$/),
    visible: z.boolean(),
  })
  .refine((v) => v.ageMin <= v.ageMax, { path: ["ageMax"] });

/** Saves dating preferences, and the Premium filters for Premium members. */
export async function savePreferences(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const user = await requireVerifiedMember("/settings/preferences");
  const parsed = preferencesSchema.safeParse({
    gender: formData.get("gender") || null,
    lookingFor: formData.getAll("lookingFor"),
    ageMin: formData.get("ageMin"),
    ageMax: formData.get("ageMax"),
    radiusKm: formData.get("radiusKm"),
    zip: String(formData.get("zip") ?? ""),
    visible: formData.get("visible") === "on",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      error:
        field === "zip"
          ? "zip"
          : field === "ageMin" || field === "ageMax"
            ? "ages"
            : "failed",
    };
  }
  const v = parsed.data;

  const location = v.zip ? await locateZip(v.zip) : null;
  if (v.zip && !location) return { error: "zip" };

  const supabase = await createClient();
  const membership = await getMembership(user.id);
  const filters: Record<string, string[]> = {};
  if (membership.premium) {
    for (const f of FILTER_FIELDS) {
      const allowed = FILTERS[f] as readonly string[];
      filters[f] = formData
        .getAll(f)
        .map(String)
        .filter((c) => allowed.includes(c));
    }
  }

  const [profile, prefs] = await Promise.all([
    supabase
      .from("profiles")
      .update({ gender: v.gender, is_visible: v.visible })
      .eq("id", user.id),
    supabase
      .from("preferences")
      .update({
        looking_for: v.lookingFor,
        age_min: v.ageMin,
        age_max: v.ageMax,
        radius_km: v.radiusKm,
        ...filters,
      })
      .eq("profile_id", user.id),
  ]);
  // Location is written by the server only, from the ZIP code.
  const loc = await createAdminClient()
    .from("account_private")
    .update({
      zip_code: v.zip || null,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
    })
    .eq("user_id", user.id);
  for (const r of [profile, prefs, loc]) {
    if (r.error) {
      console.error("savePreferences failed", r.error);
      return { error: "failed" };
    }
  }
  revalidatePath("/settings", "layout");
  revalidatePath("/discover");
  const triedFilters = FILTER_FIELDS.some((f) => formData.getAll(f).length > 0);
  return { saved: true, filtersSkipped: !membership.premium && triedFilters };
}
