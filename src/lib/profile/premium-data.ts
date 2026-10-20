import "server-only";
import { publicEnv, supabaseServerUrl } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "./data";
import {
  MULTI_CHOICE,
  SINGLE_CHOICE,
  type MultiChoiceField,
  type SingleChoiceField,
} from "./premium-options";
import type { PromptAnswer } from "./premium-schemas";

export const VIDEO_BUCKET = "videos";

export type PremiumProfile = {
  heightCm: number | null;
  profession: string | null;
  prompts: PromptAnswer[];
  videoPath: string | null;
} & Record<SingleChoiceField, string | null> &
  Record<MultiChoiceField, string[]>;

export type ExtraPhoto = { id: string; url: string | null };

const singleFields = Object.keys(SINGLE_CHOICE) as SingleChoiceField[];
const multiFields = Object.keys(MULTI_CHOICE) as MultiChoiceField[];

/**
 * A member's Premium details, read as the signed-in viewer. Row Level
 * Security returns nothing unless the viewer is the owner or a Premium
 * member allowed to see this profile.
 */
export async function getPremiumProfile(
  profileId: string,
): Promise<PremiumProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_premium")
    .select(
      [
        "height_cm",
        "profession",
        "prompts",
        "video_path",
        ...singleFields,
        ...multiFields,
      ].join(", "),
    )
    .eq("profile_id", profileId);
  if (error) throw error;
  const row = (data as unknown as Record<string, unknown>[] | null)?.[0];
  if (!row) return null;

  const profile: Record<string, unknown> = {
    heightCm: row.height_cm ?? null,
    profession: row.profession ?? null,
    prompts: (row.prompts as PromptAnswer[]) ?? [],
    videoPath: row.video_path ?? null,
  };
  for (const f of singleFields) profile[f] = row[f] ?? null;
  for (const f of multiFields) profile[f] = (row[f] as string[]) ?? [];
  return profile as PremiumProfile;
}

/** Whether a Premium profile has anything in it worth showing. */
export function hasPremiumContent(
  p: PremiumProfile | null,
  photos: ExtraPhoto[],
) {
  if (!p) return photos.length > 0;
  return (
    photos.length > 0 ||
    !!p.videoPath ||
    p.prompts.length > 0 ||
    p.heightCm !== null ||
    !!p.profession ||
    singleFields.some((f) => p[f] !== null) ||
    multiFields.some((f) => p[f].length > 0)
  );
}

function toPublicUrl(url: string) {
  const internal = supabaseServerUrl();
  return internal !== publicEnv.NEXT_PUBLIC_SUPABASE_URL
    ? url.replace(internal, publicEnv.NEXT_PUBLIC_SUPABASE_URL)
    : url;
}

/** Extra pictures in order, each with a link that works for one hour. */
export async function getExtraPhotos(profileId: string): Promise<ExtraPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_photos")
    .select("id, storage_path, position, created_at")
    .eq("profile_id", profileId)
    .order("position", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (rows.length === 0) return [];

  const { data: signed } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      60 * 60,
    );
  const byPath = new Map(
    (signed ?? []).map((s) => [
      s.path,
      s.signedUrl ? toPublicUrl(s.signedUrl) : null,
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    url: byPath.get(r.storage_path) ?? null,
  }));
}

export async function signedVideoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ? toPublicUrl(data.signedUrl) : null;
}
