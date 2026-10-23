import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  premium: boolean;
  /** Where Premium came from; "simulated" is test mode. */
  source: string | null;
  /** When Premium ends, if it does (or renews, when `renews`). */
  expiresAt: string | null;
  /** A paid subscription that renews at expiresAt (false once cancelled). */
  renews: boolean;
  /** Has a Stripe customer, so payment can be managed in the portal. */
  hasBilling: boolean;
};

/** The signed-in member's own Premium status. */
export async function getMembership(userId: string): Promise<Membership> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entitlements")
    .select("tier, source, expires_at, renews, external_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const active =
    data?.tier === "premium" &&
    (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());
  return {
    premium: active,
    source: active ? (data?.source ?? null) : null,
    expiresAt: active ? (data?.expires_at ?? null) : null,
    renews: active && !!data?.renews,
    hasBilling: !!data?.external_customer_id,
  };
}

export type PremiumTeaser = {
  extraPhotos: number;
  hasVideo: boolean;
  prompts: number;
  details: number;
};

/**
 * How much someone added to their Premium profile, never the content
 * itself. Null when the viewer may not see that person.
 */
export async function getPremiumTeaser(
  profileId: string,
): Promise<PremiumTeaser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("premium_teaser", {
    p_target: profileId,
  });
  if (error) throw error;
  const row = (
    data as
      | {
          extra_photos: number;
          has_video: boolean;
          prompts: number;
          details: number;
        }[]
      | null
  )?.[0];
  if (!row) return null;
  return {
    extraPhotos: row.extra_photos,
    hasVideo: row.has_video,
    prompts: row.prompts,
    details: row.details,
  };
}

export const teaserIsEmpty = (t: PremiumTeaser | null) =>
  !t ||
  (t.extraPhotos === 0 && !t.hasVideo && t.prompts === 0 && t.details === 0);
