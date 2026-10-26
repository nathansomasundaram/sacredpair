"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { log } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/staff";
import { createAdminClient } from "@/lib/supabase/server";
import { newPartnerKey } from "./partner-keys";
import {
  couponInputSchema,
  dayToIso,
  dollarsToCents,
  firstProblem,
} from "./validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (f: FormData, k: string, max = 2000) =>
  String(f.get(k) ?? "")
    .trim()
    .slice(0, max);
const uuid = (f: FormData, k: string) => {
  const v = text(f, k);
  return UUID.test(v) ? v : null;
};
const whole = (raw: string) => (/^\d{1,7}$/.test(raw) ? Number(raw) : null);

/* ---------------------------------------------------------------- coupons */

/** Makes a coupon from the admin form. */
export async function createCoupon(formData: FormData) {
  const staff = await requireAdmin();

  const kind = text(formData, "kind") === "amount" ? "amount" : "percent";
  const value = text(formData, "value");
  const parsed = couponInputSchema.safeParse({
    code: text(formData, "code", 40),
    description: text(formData, "description", 200),
    percent_off: kind === "percent" ? whole(value) : null,
    amount_off_cents: kind === "amount" ? dollarsToCents(value) : null,
    duration: text(formData, "duration"),
    duration_months: whole(text(formData, "months")),
    plans: formData.getAll("plans").map(String),
    max_redemptions: whole(text(formData, "max")),
    starts_at: dayToIso(text(formData, "starts")),
    expires_at: dayToIso(text(formData, "expires"), true),
  });
  if (!parsed.success) {
    redirect(`/admin/coupons?error=${firstProblem(parsed.error)}`);
  }

  const { data, error } = await createAdminClient()
    .from("coupons")
    .insert({
      ...parsed.data,
      members_only: formData.get("membersOnly") === "on",
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") redirect("/admin/coupons?error=duplicate");
    throw error;
  }
  await log({
    staff: staff.id,
    action: "coupon_created",
    note: parsed.data.code,
  });
  revalidatePath("/admin/coupons");
  redirect(`/admin/coupons/${data.id}?done=created`);
}

/** Switches a coupon on or off and changes its limit, end date and note. */
export async function updateCoupon(formData: FormData) {
  const staff = await requireAdmin();
  const id = uuid(formData, "couponId");
  if (!id) redirect("/admin/coupons");

  const expires = text(formData, "expires");
  const max = text(formData, "max");
  const expiresAt = expires ? dayToIso(expires, true) : null;
  const maxRedemptions = max ? whole(max) : null;
  if ((expires && !expiresAt) || (max && !maxRedemptions)) {
    redirect(`/admin/coupons/${id}?error=invalid`);
  }

  const db = createAdminClient();
  const { data: before } = await db
    .from("coupons")
    .select("code, starts_at")
    .eq("id", id)
    .maybeSingle();
  if (!before) redirect("/admin/coupons");
  if (expiresAt && before.starts_at && expiresAt <= before.starts_at) {
    redirect(`/admin/coupons/${id}?error=ends_before_start`);
  }

  const { error } = await db
    .from("coupons")
    .update({
      active: formData.get("active") === "on",
      members_only: formData.get("membersOnly") === "on",
      description: text(formData, "description", 200),
      max_redemptions: maxRedemptions,
      expires_at: expiresAt,
    })
    .eq("id", id);
  if (error) throw error;
  await log({ staff: staff.id, action: "coupon_updated", note: before.code });
  revalidatePath("/admin/coupons", "layout");
  redirect(`/admin/coupons/${id}?done=updated`);
}

/**
 * Plugs a coupon into a member, found by email. A coupon with members
 * plugged in is for them only, so this turns on "only specific members".
 */
export async function assignCoupon(formData: FormData) {
  const staff = await requireAdmin();
  const id = uuid(formData, "couponId");
  if (!id) redirect("/admin/coupons");
  const email = text(formData, "email", 254).toLowerCase();

  const db = createAdminClient();
  const { data } = await db.rpc("staff_search_members", { p_query: email });
  const match = ((data ?? []) as { id: string; email: string }[]).find(
    (m) => m.email?.toLowerCase() === email,
  );
  if (!match) redirect(`/admin/coupons/${id}?error=notFound`);

  const { error } = await db
    .from("coupon_members")
    .upsert(
      { coupon_id: id, user_id: match.id, assigned_by: staff.id },
      { onConflict: "coupon_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
  const { data: c, error: e2 } = await db
    .from("coupons")
    .update({ members_only: true })
    .eq("id", id)
    .select("code")
    .single();
  if (e2) throw e2;
  await log({
    staff: staff.id,
    action: "coupon_assigned",
    target: match.id,
    note: c.code,
  });
  revalidatePath(`/admin/coupons/${id}`);
  redirect(`/admin/coupons/${id}?done=assigned`);
}

export async function unassignCoupon(formData: FormData) {
  const staff = await requireAdmin();
  const id = uuid(formData, "couponId");
  const userId = uuid(formData, "userId");
  if (!id || !userId) redirect("/admin/coupons");
  const db = createAdminClient();
  await db
    .from("coupon_members")
    .delete()
    .eq("coupon_id", id)
    .eq("user_id", userId);
  const { data: c } = await db
    .from("coupons")
    .select("code")
    .eq("id", id)
    .maybeSingle();
  await log({
    staff: staff.id,
    action: "coupon_unassigned",
    target: userId,
    note: c?.code ?? "",
  });
  revalidatePath(`/admin/coupons/${id}`);
  redirect(`/admin/coupons/${id}?done=unassigned`);
}

/* --------------------------------------------------------------- partners */

export type PartnerFormState =
  | { status: "idle" }
  | { status: "error"; error: "name" | "percent" | "duplicate" }
  | { status: "created"; name: string; key: string };

/**
 * Makes a partner and returns its API key. This is the only time the key
 * exists in readable form: it goes straight back to the form on the screen.
 */
export async function createPartner(
  _previous: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const staff = await requireAdmin();
  const name = text(formData, "name", 60);
  const max = whole(text(formData, "maxPercent"));
  if (name.length < 2) return { status: "error", error: "name" };
  if (max === null || max < 1 || max > 100)
    return { status: "error", error: "percent" };

  const { key, hash } = newPartnerKey();
  const { error } = await createAdminClient().from("coupon_partners").insert({
    name,
    key_hash: hash,
    max_percent_off: max,
    created_by: staff.id,
  });
  if (error) {
    if (error.code === "23505") return { status: "error", error: "duplicate" };
    throw error;
  }
  await log({ staff: staff.id, action: "partner_created", note: name });
  revalidatePath("/admin/coupons/partners");
  return { status: "created", name, key };
}

/** Switches a partner's key on or off. Its coupons keep working until used or ended. */
export async function setPartnerActive(formData: FormData) {
  const staff = await requireAdmin();
  const id = uuid(formData, "partnerId");
  if (!id) redirect("/admin/coupons/partners");
  const active = text(formData, "active") === "1";
  const { data, error } = await createAdminClient()
    .from("coupon_partners")
    .update({ active })
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (error) throw error;
  await log({
    staff: staff.id,
    action: "partner_updated",
    note: `${data?.name ?? ""}: ${active ? "on" : "off"}`,
  });
  revalidatePath("/admin/coupons/partners");
  redirect("/admin/coupons/partners");
}

/** Turns off every unused coupon a partner made, for example after a leaked key. */
export async function endPartnerCoupons(formData: FormData) {
  const staff = await requireAdmin();
  const id = uuid(formData, "partnerId");
  if (!id) redirect("/admin/coupons/partners");
  const db = createAdminClient();
  const { data: partner } = await db
    .from("coupon_partners")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await db
    .from("coupons")
    .update({ active: false })
    .eq("partner_id", id);
  if (error) throw error;
  await log({
    staff: staff.id,
    action: "partner_updated",
    note: `${partner?.name ?? ""}: coupons ended`,
  });
  revalidatePath("/admin/coupons", "layout");
  redirect("/admin/coupons/partners");
}
