import { partnerFromRequest, publicCoupon } from "@/lib/coupons/partner-api";
import {
  couponInputSchema,
  firstProblem,
  partnerViolation,
} from "@/lib/coupons/validation";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Partner sites make coupon codes here. Send "Authorization: Bearer <key>"
 * (a key staff make under Admin > Coupons > Partners) and a JSON body:
 *
 *   { "code": "FRIENDS20", "percent_off": 20, "duration": "once",
 *     "max_redemptions": 1, "expires_at": "2026-12-31T23:59:59Z",
 *     "member_email": "optional@example.com" }
 *
 * Partners make percentage discounts only, up to their own cap, and a code
 * can be used once unless max_redemptions says otherwise. With member_email
 * the code works for that member only. Members then use the code on the
 * upgrade screen, or through a link like /upgrade?coupon=FRIENDS20.
 */
export async function POST(request: Request) {
  const partner = await partnerFromRequest(request);
  if (!partner)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const { member_email: memberEmail, ...rest } = body as Record<
    string,
    unknown
  >;
  if (memberEmail !== undefined && typeof memberEmail !== "string") {
    return Response.json({ error: "member_email" }, { status: 400 });
  }

  const parsed = couponInputSchema.safeParse(rest);
  if (!parsed.success) {
    return Response.json(
      { error: firstProblem(parsed.error) },
      { status: 400 },
    );
  }
  const violation = partnerViolation(parsed.data, {
    max_percent_off: partner.maxPercentOff,
  });
  if (violation) return Response.json({ error: violation }, { status: 422 });

  const db = createAdminClient();
  let memberId: string | null = null;
  if (memberEmail) {
    const email = memberEmail.trim().toLowerCase();
    const { data } = await db.rpc("staff_search_members", { p_query: email });
    const match = ((data ?? []) as { id: string; email: string }[]).find(
      (m) => m.email?.toLowerCase() === email,
    );
    if (!match) {
      return Response.json({ error: "member_not_found" }, { status: 422 });
    }
    memberId = match.id;
  }

  const { data: made, error } = await db
    .from("coupons")
    .insert({
      ...parsed.data,
      max_redemptions: parsed.data.max_redemptions ?? 1,
      members_only: memberId !== null,
      partner_id: partner.id,
    })
    .select(
      "id, code, percent_off, duration, duration_months, plans, max_redemptions, starts_at, expires_at, active",
    )
    .single();
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "code_taken" }, { status: 409 });
    }
    console.error("Partner coupon insert failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
  if (memberId) {
    const { error: e } = await db
      .from("coupon_members")
      .insert({ coupon_id: made.id, user_id: memberId });
    if (e) {
      await db.from("coupons").delete().eq("id", made.id);
      console.error("Partner coupon assignment failed", e);
      return Response.json({ error: "failed" }, { status: 500 });
    }
  }
  return Response.json(publicCoupon(made), { status: 201 });
}
