import { normalizeCode } from "@/lib/coupons/pricing";
import { partnerFromRequest, publicCoupon } from "@/lib/coupons/partner-api";
import { createAdminClient } from "@/lib/supabase/server";

const COLUMNS =
  "id, code, percent_off, duration, duration_months, plans, max_redemptions, starts_at, expires_at, active";

/** A partner's own coupon: never one made by staff or another partner. */
async function own(request: Request, rawCode: string) {
  const partner = await partnerFromRequest(request);
  if (!partner) {
    return {
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const { data, error } = await createAdminClient()
    .from("coupons")
    .select(COLUMNS)
    .eq("code", normalizeCode(rawCode))
    .eq("partner_id", partner.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { response: Response.json({ error: "not_found" }, { status: 404 }) };
  }
  return { coupon: data };
}

/** How a code is doing: its terms and how many times it was used. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/partners/coupons/[code]">,
) {
  const { code } = await ctx.params;
  const found = await own(request, code);
  if (found.response) return found.response;
  const { count } = await createAdminClient()
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", found.coupon.id)
    .eq("status", "completed");
  return Response.json({ ...publicCoupon(found.coupon), redeemed: count ?? 0 });
}

/** Switches a code off, so it can't be used any more. */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/partners/coupons/[code]">,
) {
  const { code } = await ctx.params;
  const found = await own(request, code);
  if (found.response) return found.response;
  const { error } = await createAdminClient()
    .from("coupons")
    .update({ active: false })
    .eq("id", found.coupon.id);
  if (error) throw error;
  return Response.json({ ...publicCoupon(found.coupon), active: false });
}
