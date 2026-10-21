import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PublishedStory = {
  id: string;
  displayName: string;
  partnerName: string;
  place: string;
  body: string;
};

/** Stories staff have approved; never says which member wrote them. */
export async function getPublishedStories(limit = 50): Promise<PublishedStory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_stories", { p_limit: limit });
  if (error) {
    console.error("published_stories failed", error);
    return [];
  }
  return ((data ?? []) as { id: string; display_name: string; partner_name: string; place: string; body: string }[]).map(
    (s) => ({ id: s.id, displayName: s.display_name, partnerName: s.partner_name, place: s.place, body: s.body }),
  );
}
