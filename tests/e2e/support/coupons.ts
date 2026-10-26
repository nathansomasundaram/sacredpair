import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env";

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Removes coupons (and their uses) and partners made by a test. */
export async function deleteCoupons(codes: string[], partners: string[] = []) {
  if (codes.length) await admin.from("coupons").delete().in("code", codes);
  if (partners.length) {
    await admin.from("coupon_partners").delete().in("name", partners);
  }
}

/** A coupon as stored, for checking what the screens and API did. */
export async function couponRow(code: string) {
  const { data, error } = await admin
    .from("coupons")
    .select(
      "id, code, percent_off, amount_off_cents, duration, members_only, max_redemptions, active, partner_id",
    )
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Who a coupon was plugged into. */
export async function couponMembers(couponId: string) {
  const { data, error } = await admin
    .from("coupon_members")
    .select("user_id")
    .eq("coupon_id", couponId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}
