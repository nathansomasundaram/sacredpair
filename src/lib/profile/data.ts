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

const OVERVIEW_COLUMNS =
  "id, display_name, birthdate, city, state_code, about_me, traits, primary_photo_path, is_complete";

type OverviewRow = {
  id: string;
  display_name: string;
  birthdate: string | null;
  city: string;
  state_code: UsState | "";
  about_me: string;
  traits: Trait[] | null;
  primary_photo_path: string | null;
  is_complete: boolean;
};

function toOverview(row: OverviewRow): ProfileOverview {
  return {
    id: row.id,
    displayName: row.display_name,
    age: row.birthdate ? ageOn(row.birthdate) : null,
    city: row.city,
    stateCode: row.state_code,
    aboutMe: row.about_me,
    traits: row.traits ?? [],
    photoPath: row.primary_photo_path,
    isComplete: row.is_complete,
  };
}

/**
 * Profile overviews the signed-in member is allowed to see, in the order
 * asked for. Row Level Security leaves out anyone they may not see.
 */
export async function getProfileOverviews(
  ids: string[],
): Promise<ProfileOverview[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(OVERVIEW_COLUMNS)
    .in("id", ids);
  if (error) throw error;
  const byId = new Map(
    (data as OverviewRow[]).map((r) => [r.id, toOverview(r)]),
  );
  return ids.map((id) => byId.get(id)).filter((p): p is ProfileOverview => !!p);
}

/** One overview, or null if the member may not see it. */
export async function getProfileOverview(
  id: string,
): Promise<ProfileOverview | null> {
  return (await getProfileOverviews([id]))[0] ?? null;
}

/** The member's own overview, read as them (Row Level Security applies). */
export async function getOwnProfile(userId: string): Promise<ProfileOverview> {
  const own = await getProfileOverview(userId);
  if (!own) throw new Error("Own profile not readable");
  return own;
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

/** Hour-long links for several photos at once, keyed by storage path. */
export async function signedPhotoUrls(
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return new Map();
  const { data } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(list, 60 * 60);
  const internal = supabaseServerUrl();
  const fix = (url: string) =>
    internal !== publicEnv.NEXT_PUBLIC_SUPABASE_URL
      ? url.replace(internal, publicEnv.NEXT_PUBLIC_SUPABASE_URL)
      : url;
  const urls = new Map<string, string>();
  for (const d of data ?? []) {
    if (d.path && d.signedUrl) urls.set(d.path, fix(d.signedUrl));
  }
  return urls;
}
