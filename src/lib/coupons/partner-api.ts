import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { bearerKey, hashPartnerKey } from "./partner-keys";

export type Partner = { id: string; name: string; maxPercentOff: number };

/**
 * The partner behind an "Authorization: Bearer spk_..." header, or null when
 * the key is missing, wrong or switched off. The key is compared by its hash.
 */
export async function partnerFromRequest(
  request: Request,
): Promise<Partner | null> {
  const key = bearerKey(request.headers.get("authorization"));
  if (!key) return null;
  const { data, error } = await createAdminClient()
    .from("coupon_partners")
    .select("id, name, max_percent_off, active")
    .eq("key_hash", hashPartnerKey(key))
    .maybeSingle();
  if (error) throw error;
  if (!data?.active) return null;
  return { id: data.id, name: data.name, maxPercentOff: data.max_percent_off };
}

/** How a coupon is described to the partner that made it. */
export function publicCoupon(c: {
  code: string;
  percent_off: number | null;
  duration: string;
  duration_months: number | null;
  plans: string[];
  max_redemptions: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
}) {
  return {
    code: c.code,
    percent_off: c.percent_off,
    duration: c.duration,
    duration_months: c.duration_months,
    plans: c.plans,
    max_redemptions: c.max_redemptions,
    starts_at: c.starts_at,
    expires_at: c.expires_at,
    active: c.active,
  };
}
