import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { CouponDuration } from "./pricing";

// Read with the server's own key, after requireAdmin() has checked who is
// asking. Nothing here is reachable from the browser.

const admin = () => createAdminClient();

export type CouponRow = {
  id: string;
  code: string;
  description: string;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  duration: CouponDuration;
  durationMonths: number | null;
  plans: string[];
  membersOnly: boolean;
  partnerName: string | null;
  maxRedemptions: number | null;
  redeemed: number;
  assigned: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

const COLUMNS =
  "id, code, description, percent_off, amount_off_cents, currency, duration, duration_months, plans, members_only, max_redemptions, starts_at, expires_at, active, created_at, coupon_partners(name)";

type Raw = {
  id: string;
  code: string;
  description: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string;
  duration: string;
  duration_months: number | null;
  plans: string[];
  members_only: boolean;
  max_redemptions: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  coupon_partners: { name: string } | null;
};

function shape(r: Raw, redeemed: number, assigned: number): CouponRow {
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    percentOff: r.percent_off,
    amountOffCents: r.amount_off_cents,
    currency: r.currency,
    duration: r.duration as CouponDuration,
    durationMonths: r.duration_months,
    plans: r.plans,
    membersOnly: r.members_only,
    partnerName: r.coupon_partners?.name ?? null,
    maxRedemptions: r.max_redemptions,
    redeemed,
    assigned,
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    active: r.active,
    createdAt: r.created_at,
  };
}

function tally(rows: { coupon_id: string }[] | null) {
  const counts = new Map<string, number>();
  for (const r of rows ?? [])
    counts.set(r.coupon_id, (counts.get(r.coupon_id) ?? 0) + 1);
  return counts;
}

/** The newest coupons first, with how many times each was used. */
export async function listCoupons(): Promise<CouponRow[]> {
  const { data, error } = await admin()
    .from("coupons")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Raw[];
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const [used, assigned] = await Promise.all([
    admin()
      .from("coupon_redemptions")
      .select("coupon_id")
      .eq("status", "completed")
      .in("coupon_id", ids),
    admin().from("coupon_members").select("coupon_id").in("coupon_id", ids),
  ]);
  const usedBy = tally(used.data);
  const assignedTo = tally(assigned.data);
  return rows.map((r) =>
    shape(r, usedBy.get(r.id) ?? 0, assignedTo.get(r.id) ?? 0),
  );
}

export type CouponMember = { id: string; name: string; email: string | null };
export type CouponRedemption = CouponMember & {
  plan: string;
  status: "pending" | "completed";
  at: string;
};

async function people(ids: string[]): Promise<Map<string, CouponMember>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const [{ data }, emails] = await Promise.all([
    admin().from("profiles").select("id, display_name").in("id", unique),
    Promise.all(unique.map((id) => admin().auth.admin.getUserById(id))),
  ]);
  const emailById = new Map(
    unique.map((id, i) => [id, emails[i].data?.user?.email ?? null]),
  );
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        name: p.display_name || "—",
        email: emailById.get(p.id) ?? null,
      },
    ]),
  );
}

/** One coupon with the members it's plugged into and who used it. */
export async function getCoupon(id: string) {
  const { data, error } = await admin()
    .from("coupons")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [assigned, used] = await Promise.all([
    admin().from("coupon_members").select("user_id").eq("coupon_id", id),
    admin()
      .from("coupon_redemptions")
      .select("user_id, plan, status, created_at, completed_at")
      .eq("coupon_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const who = await people([
    ...(assigned.data ?? []).map((a) => a.user_id),
    ...(used.data ?? []).map((u) => u.user_id),
  ]);
  const redemptions: CouponRedemption[] = (used.data ?? []).flatMap((u) => {
    const p = who.get(u.user_id);
    return p
      ? [
          {
            ...p,
            plan: u.plan,
            status: u.status as "pending" | "completed",
            at: u.completed_at ?? u.created_at,
          },
        ]
      : [];
  });
  const members = (assigned.data ?? []).flatMap(
    (a) => who.get(a.user_id) ?? [],
  );
  return {
    coupon: shape(
      data as unknown as Raw,
      redemptions.filter((r) => r.status === "completed").length,
      members.length,
    ),
    members,
    redemptions,
  };
}

export type PartnerRow = {
  id: string;
  name: string;
  maxPercentOff: number;
  active: boolean;
  createdAt: string;
  coupons: number;
};

export async function listPartners(): Promise<PartnerRow[]> {
  const { data, error } = await admin()
    .from("coupon_partners")
    .select("id, name, max_percent_off, active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const made = await admin()
    .from("coupons")
    .select("partner_id")
    .not("partner_id", "is", null);
  const counts = new Map<string, number>();
  for (const c of made.data ?? []) {
    if (c.partner_id)
      counts.set(c.partner_id, (counts.get(c.partner_id) ?? 0) + 1);
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    maxPercentOff: p.max_percent_off,
    active: p.active,
    createdAt: p.created_at,
    coupons: counts.get(p.id) ?? 0,
  }));
}
