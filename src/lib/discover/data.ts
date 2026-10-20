import "server-only";
import {
  getProfileOverviews,
  signedPhotoUrls,
  type ProfileOverview,
} from "@/lib/profile/data";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "./week";

export { INTRODUCTIONS_PER_WEEK } from "./week";

export type Introduction = {
  profile: ProfileOverview;
  photoUrl: string | null;
};

export type DiscoverWeek = {
  /** Monday the current week started (US Eastern), as YYYY-MM-DD. */
  week: string;
  /** Monday the next four arrive. */
  nextWeek: string;
  /** Whether the wand was used this week. */
  revealed: boolean;
  introductions: Introduction[];
};

/**
 * This week's introductions for the signed-in member, in the order they
 * were made. Read as the member, so Row Level Security applies throughout.
 */
export async function getDiscoverWeek(userId: string): Promise<DiscoverWeek> {
  const supabase = await createClient();
  const { data: week, error: weekError } = await supabase.rpc("discovery_week");
  if (weekError) throw weekError;
  const weekStart = String(week).slice(0, 10);

  const { data: batch, error: batchError } = await supabase
    .from("discovery_batches")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (batchError) throw batchError;

  let items: { profile_id: string }[] = [];
  if (batch) {
    const { data, error } = await supabase
      .from("discovery_batch_items")
      .select("profile_id, position")
      .eq("batch_id", batch.id)
      .order("position", { ascending: true });
    if (error) throw error;
    items = data ?? [];
  }

  const profiles = await getProfileOverviews(items.map((i) => i.profile_id));
  const urls = await signedPhotoUrls(profiles.map((p) => p.photoPath));

  return {
    week: weekStart,
    nextWeek: addDays(weekStart, 7),
    revealed: !!batch,
    introductions: profiles.map((profile) => ({
      profile,
      photoUrl: profile.photoPath
        ? (urls.get(profile.photoPath) ?? null)
        : null,
    })),
  };
}
