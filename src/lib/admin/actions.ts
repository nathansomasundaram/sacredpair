"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAccountNotice } from "@/lib/notify/notify";
import { PHOTO_BUCKET } from "@/lib/profile/data";
import { VIDEO_BUCKET } from "@/lib/profile/premium-data";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "./staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const id = (f: FormData, k: string) => {
  const v = text(f, k);
  return UUID.test(v) ? v : null;
};

async function log(entry: {
  staff: string;
  action: string;
  target?: string | null;
  report?: string | null;
  story?: string | null;
  note?: string;
}) {
  const { error } = await createAdminClient().from("moderation_actions").insert({
    staff_id: entry.staff,
    action: entry.action,
    target_user: entry.target ?? null,
    report_id: entry.report ?? null,
    story_id: entry.story ?? null,
    note: entry.note ?? "",
  });
  if (error) throw error;
}

/* ---------------------------------------------------------------- reports */

export async function setReportStatus(formData: FormData) {
  const staff = await requireStaff();
  const reportId = id(formData, "reportId");
  const status = text(formData, "status");
  if (!reportId || !["reviewing", "resolved", "dismissed"].includes(status)) redirect("/admin/reports");
  const note = text(formData, "note");
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("reported_id").eq("id", reportId).single();
  const { error } = await db
    .from("reports")
    .update({
      status,
      reviewed_by: staff.id,
      resolution_note: note,
      resolved_at: status === "reviewing" ? null : new Date().toISOString(),
    })
    .eq("id", reportId);
  if (error) throw error;
  await log({ staff: staff.id, action: `report_${status}`, target: r?.reported_id, report: reportId, note });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reports/${reportId}?done=${status}`);
}

/* ---------------------------------------------------------------- members */

/**
 * Suspends a member: hidden everywhere, connections ended, sign-in blocked,
 * and told by email. Optionally resolves the report that led to it.
 */
export async function suspendMember(formData: FormData) {
  const staff = await requireStaff();
  const target = id(formData, "userId");
  const reportId = id(formData, "reportId");
  const note = text(formData, "note");
  if (!target || target === staff.id) redirect("/admin/members");
  const db = createAdminClient();
  const { error } = await db.rpc("suspend_member", {
    p_target: target,
    p_staff: staff.id,
    p_note: note,
    p_report: reportId,
  });
  if (error) throw error;
  // Block sign-in, and mark the login so open sessions are stopped too.
  const { data: u } = await db.auth.admin.getUserById(target);
  await db.auth.admin.updateUserById(target, {
    ban_duration: "876000h",
    app_metadata: { ...(u?.user?.app_metadata ?? {}), suspended: true },
  });
  if (reportId) {
    await db
      .from("reports")
      .update({ status: "resolved", reviewed_by: staff.id, resolution_note: note, resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    await log({ staff: staff.id, action: "report_resolved", target, report: reportId, note });
  }
  await sendAccountNotice(target, "suspended");
  revalidatePath("/admin", "layout");
  redirect(reportId ? `/admin/reports/${reportId}?done=suspended` : `/admin/members/${target}?done=suspended`);
}

export async function reinstateMember(formData: FormData) {
  const staff = await requireStaff();
  const target = id(formData, "userId");
  if (!target) redirect("/admin/members");
  const note = text(formData, "note");
  const db = createAdminClient();
  const { error } = await db.rpc("reinstate_member", { p_target: target, p_staff: staff.id, p_note: note });
  if (error) throw error;
  const { data: u } = await db.auth.admin.getUserById(target);
  await db.auth.admin.updateUserById(target, {
    ban_duration: "none",
    app_metadata: { ...(u?.user?.app_metadata ?? {}), suspended: false },
  });
  await sendAccountNotice(target, "reinstated");
  revalidatePath("/admin", "layout");
  redirect(`/admin/members/${target}?done=reinstated`);
}

/** Removes part of a member's profile that breaks the guidelines. */
export async function removeContent(formData: FormData) {
  const staff = await requireStaff();
  const target = id(formData, "userId");
  const what = text(formData, "what");
  const note = text(formData, "note");
  if (!target) redirect("/admin/members");
  const db = createAdminClient();

  if (what === "photo") {
    const { data: p } = await db.from("profiles").select("primary_photo_path").eq("id", target).single();
    if (p?.primary_photo_path) await db.storage.from(PHOTO_BUCKET).remove([p.primary_photo_path]);
    await db.from("profiles").update({ primary_photo_path: null }).eq("id", target);
  } else if (what === "extra_photo") {
    const photoId = id(formData, "photoId");
    if (!photoId) redirect(`/admin/members/${target}`);
    const { data: ph } = await db.from("profile_photos").select("storage_path").eq("id", photoId).eq("profile_id", target).single();
    if (ph) await db.storage.from(PHOTO_BUCKET).remove([ph.storage_path]);
    await db.from("profile_photos").delete().eq("id", photoId).eq("profile_id", target);
  } else if (what === "video") {
    const { data: pp } = await db.from("profile_premium").select("video_path").eq("profile_id", target).single();
    if (pp?.video_path) await db.storage.from(VIDEO_BUCKET).remove([pp.video_path]);
    await db.from("profile_premium").update({ video_path: null }).eq("profile_id", target);
  } else if (what === "about") {
    await db.from("profiles").update({ about_me: "" }).eq("id", target);
  } else if (what === "prompts") {
    await db.from("profile_premium").update({ prompts: [] }).eq("profile_id", target);
  } else {
    redirect(`/admin/members/${target}`);
  }

  const action = what === "about" ? "clear_about" : what === "prompts" ? "clear_prompts" : `remove_${what}`;
  await log({ staff: staff.id, action, target, note });
  await sendAccountNotice(target, "contentRemoved");
  revalidatePath(`/admin/members/${target}`);
  redirect(`/admin/members/${target}?done=removed`);
}

/* ---------------------------------------------------------------- stories */

export async function reviewStory(formData: FormData) {
  const staff = await requireStaff();
  const storyId = id(formData, "storyId");
  const decision = text(formData, "decision");
  if (!storyId || !["approve", "reject", "unpublish"].includes(decision)) redirect("/admin/stories");
  const db = createAdminClient();
  const { data: s } = await db.from("stories").select("author_id").eq("id", storyId).single();
  const now = new Date().toISOString();
  const update =
    decision === "approve"
      ? { status: "approved", reviewed_by: staff.id, reviewed_at: now, published_at: now }
      : { status: "rejected", reviewed_by: staff.id, reviewed_at: now, published_at: null };
  const { error } = await db.from("stories").update(update).eq("id", storyId);
  if (error) throw error;
  const action = decision === "approve" ? "story_approved" : decision === "reject" ? "story_rejected" : "story_unpublished";
  await log({ staff: staff.id, action, target: s?.author_id, story: storyId });
  revalidatePath("/admin", "layout");
  revalidatePath("/stories");
  revalidatePath("/");
  redirect(`/admin/stories?status=${decision === "approve" ? "pending" : decision === "reject" ? "pending" : "approved"}&done=${decision}`);
}

/* ------------------------------------------------------------------ staff */

export async function addStaff(formData: FormData) {
  const staff = await requireAdmin();
  const email = text(formData, "email", 254).toLowerCase();
  const role = text(formData, "role") === "admin" ? "admin" : "moderator";
  const db = createAdminClient();
  const { data } = await db.rpc("staff_search_members", { p_query: email });
  const match = ((data ?? []) as { id: string; email: string }[]).find((m) => m.email?.toLowerCase() === email);
  if (!match) redirect("/admin/staff?error=notFound");
  const { error } = await db.from("staff").upsert({ user_id: match.id, role, added_by: staff.id }, { onConflict: "user_id" });
  if (error) throw error;
  await log({ staff: staff.id, action: "staff_added", target: match.id, note: role });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?done=added");
}

export async function removeStaff(formData: FormData) {
  const staff = await requireAdmin();
  const target = id(formData, "userId");
  if (!target) redirect("/admin/staff");
  const db = createAdminClient();
  const { data: admins } = await db.from("staff").select("user_id").eq("role", "admin");
  if (target === staff.id && (admins ?? []).length <= 1) redirect("/admin/staff?error=lastAdmin");
  await db.from("staff").delete().eq("user_id", target);
  await log({ staff: staff.id, action: "staff_removed", target });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?done=removed");
}
