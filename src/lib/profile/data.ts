import "server-only";
import { ageOn } from "@/lib/auth/schemas";
import { publicEnv, supabaseServerUrl } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Trait, UsState } from "./options";

export const PHOTO_BUCKET = "photos";

export type ProfileOverview = {
  id: string;
  displayName: string;
  age: number | null;
  city: string;
  stateCode: UsState | "";
  aboutMe: string;
  traits: Trait[];
  photoPath: string | null;
  isComplete: boolean;
};

/** The member's own overview, read as them (Row Level Security applies). */
export async function getOwnProfile(userId: string): Promise<ProfileOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, birthdate, city, state_code, about_me, traits, primary_photo_path, is_complete",
    )
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    displayName: data.display_name,
    age: data.birthdate ? ageOn(data.birthdate) : null,
    city: data.city,
    stateCode: data.state_code,
    aboutMe: data.about_me,
    traits: data.traits ?? [],
    photoPath: data.primary_photo_path,
    isComplete: data.is_complete,
  };
}

/**
 * A link to a private photo that works for one hour. Photos are never
 * public, so a link can't be shared or guessed for long.
 */
export async function signedPhotoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  // In Docker the server reaches Supabase by an internal address; the
  // browser needs the public one.
  const internal = supabaseServerUrl();
  return internal !== publicEnv.NEXT_PUBLIC_SUPABASE_URL
    ? data.signedUrl.replace(internal, publicEnv.NEXT_PUBLIC_SUPABASE_URL)
    : data.signedUrl;
}
