import "server-only";
import { publicEnv, supabaseServerUrl } from "@/lib/env";
import { PHOTO_BUCKET } from "@/lib/profile/data";
import { VIDEO_BUCKET } from "@/lib/profile/premium-data";
import { createAdminClient } from "@/lib/supabase/server";

// The moderation area reads with the server's own key, after requireStaff()
// has checked who is asking. Nothing here is reachable from the browser.

const admin = () => createAdminClient();

const publicUrl = (url: string) => {
  const internal = supabaseServerUrl();
  return internal !== publicEnv.NEXT_PUBLIC_SUPABASE_URL ? url.replace(internal, publicEnv.NEXT_PUBLIC_SUPABASE_URL) : url;
};

async function signed(bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await admin().storage.from(bucket).createSignedUrl(path, 60 * 15);
  return data?.signedUrl ? publicUrl(data.signedUrl) : null;
}

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export const REPORT_STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];

export type MemberSummary = { id: string; name: string; email: string | null; suspended: boolean };

async function members(ids: string[]): Promise<Map<string, MemberSummary>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await admin().from("profiles").select("id, display_name, banned_at").in("id", unique);
  const emails = await Promise.all(unique.map((id) => admin().auth.admin.getUserById(id)));
  const emailById = new Map(unique.map((id, i) => [id, emails[i].data?.user?.email ?? null]));
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      { id: p.id, name: p.display_name || "—", email: emailById.get(p.id) ?? null, suspended: !!p.banned_at },
    ]),
  );
}

export async function getOverview() {
  const c = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const db = admin();
  const [openReports, reviewing, pendingStories, membersTotal, verified, suspended, premium] = await Promise.all([
    c(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    c(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "reviewing")),
    c(db.from("stories").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(db.from("profiles").select("id", { count: "exact", head: true })),
    c(db.from("profiles").select("id", { count: "exact", head: true }).not("id_verified_at", "is", null)),
    c(db.from("profiles").select("id", { count: "exact", head: true }).not("banned_at", "is", null)),
    c(db.from("entitlements").select("user_id", { count: "exact", head: true }).eq("tier", "premium")),
  ]);
  return { openReports, reviewing, pendingStories, membersTotal, verified, suspended, premium };
}

export type ReportRow = {
  id: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
  reporter: MemberSummary | undefined;
  reported: MemberSummary | undefined;
};

export async function listReports(status: ReportStatus): Promise<ReportRow[]> {
  const { data, error } = await admin()
    .from("reports")
    .select("id, reporter_id, reported_id, reason, details, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "open" || status === "reviewing" })
    .limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const people = await members(rows.flatMap((r) => [r.reporter_id, r.reported_id]));
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status as ReportStatus,
    createdAt: r.created_at,
    reporter: people.get(r.reporter_id),
    reported: people.get(r.reported_id),
  }));
}

export type ReportDetail = ReportRow & {
  connectionId: string | null;
  messageId: number | null;
  note: string;
  reviewedBy: MemberSummary | undefined;
  conversation: { id: number; fromReported: boolean; body: string; at: string }[];
  otherReports: number;
};

export async function getReport(id: string): Promise<ReportDetail | null> {
  const { data: r } = await admin().from("reports").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const people = await members([r.reporter_id, r.reported_id, r.reviewed_by]);
  let conversation: ReportDetail["conversation"] = [];
  if (r.connection_id) {
    const { data } = await admin()
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("connection_id", r.connection_id)
      .order("id", { ascending: true })
      .limit(500);
    conversation = (data ?? []).map((m) => ({
      id: Number(m.id),
      fromReported: m.sender_id === r.reported_id,
      body: m.body,
      at: m.created_at,
    }));
  }
  const { count } = await admin()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reported_id", r.reported_id)
    .neq("id", id);
  return {
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    reporter: people.get(r.reporter_id),
    reported: people.get(r.reported_id),
    connectionId: r.connection_id,
    messageId: r.message_id ? Number(r.message_id) : null,
    note: r.resolution_note ?? "",
    reviewedBy: r.reviewed_by ? people.get(r.reviewed_by) : undefined,
    conversation,
    otherReports: count ?? 0,
  };
}

export type SearchRow = {
  id: string;
  email: string;
  name: string;
  place: string;
  joined: string;
  verified: boolean;
  suspended: boolean;
  openReports: number;
};

export async function searchMembers(query: string): Promise<SearchRow[]> {
  const { data, error } = await admin().rpc("staff_search_members", { p_query: query });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    email: (m.email as string) ?? "",
    name: (m.display_name as string) || "—",
    place: [m.city, m.state_code].filter(Boolean).join(", "),
    joined: m.created_at as string,
    verified: !!m.id_verified,
    suspended: !!m.banned_at,
    openReports: Number(m.open_reports ?? 0),
  }));
}

export async function getMember(id: string) {
  const db = admin();
  const { data: p } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const [{ data: auth }, { data: priv }, { data: ent }, { data: prem }, { data: photos }, about, by, actions] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("account_private").select("phone, phone_verified_at, zip_code").eq("user_id", id).maybeSingle(),
    db.from("entitlements").select("tier, source, expires_at").eq("user_id", id).maybeSingle(),
    db.from("profile_premium").select("video_path, prompts").eq("profile_id", id).maybeSingle(),
    db.from("profile_photos").select("id, storage_path, position").eq("profile_id", id).order("position"),
    db.from("reports").select("id, reason, status, created_at").eq("reported_id", id).order("created_at", { ascending: false }),
    db.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", id),
    db
      .from("moderation_actions")
      .select("id, action, note, created_at, staff_id")
      .eq("target_user", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const extra = await Promise.all(
    (photos ?? []).map(async (ph) => ({ id: ph.id as string, url: await signed(PHOTO_BUCKET, ph.storage_path) })),
  );
  const staff = await members((actions.data ?? []).map((a) => a.staff_id).filter(Boolean) as string[]);
  return {
    id,
    name: p.display_name || "—",
    email: auth?.user?.email ?? null,
    city: p.city,
    stateCode: p.state_code,
    aboutMe: p.about_me ?? "",
    joined: p.created_at,
    idVerified: !!p.id_verified_at,
    suspendedAt: p.banned_at as string | null,
    visible: p.is_visible,
    phone: priv?.phone ?? null,
    phoneVerified: !!priv?.phone_verified_at,
    premium: ent?.tier === "premium",
    photoUrl: await signed(PHOTO_BUCKET, p.primary_photo_path),
    hasPhoto: !!p.primary_photo_path,
    extraPhotos: extra,
    videoUrl: await signed(VIDEO_BUCKET, prem?.video_path ?? null),
    promptCount: Array.isArray(prem?.prompts) ? prem!.prompts.length : 0,
    reportsAbout: (about.data ?? []).map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.created_at })),
    reportsFiled: by.count ?? 0,
    actions: (actions.data ?? []).map((a) => ({
      id: Number(a.id),
      action: a.action,
      note: a.note,
      at: a.created_at,
      by: a.staff_id ? (staff.get(a.staff_id)?.name ?? "—") : "—",
    })),
  };
}

export type StoryRow = {
  id: string;
  displayName: string;
  partnerName: string;
  place: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  author: MemberSummary | undefined;
};

export async function listStories(status: StoryRow["status"]): Promise<StoryRow[]> {
  const { data, error } = await admin()
    .from("stories")
    .select("id, author_id, display_name, partner_name, place, body, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  if (error) throw error;
  const people = await members((data ?? []).map((s) => s.author_id));
  return (data ?? []).map((s) => ({
    id: s.id,
    displayName: s.display_name,
    partnerName: s.partner_name,
    place: s.place,
    body: s.body,
    status: s.status,
    createdAt: s.created_at,
    author: people.get(s.author_id),
  }));
}

export async function listStaff() {
  const { data } = await admin().from("staff").select("user_id, role, created_at").order("created_at");
  const people = await members((data ?? []).map((s) => s.user_id));
  return (data ?? []).map((s) => ({ ...people.get(s.user_id), id: s.user_id, role: s.role as "admin" | "moderator", since: s.created_at }));
}

export async function recentActions(limit = 100) {
  const { data } = await admin()
    .from("moderation_actions")
    .select("id, staff_id, action, target_user, report_id, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const people = await members((data ?? []).flatMap((a) => [a.staff_id, a.target_user]).filter(Boolean) as string[]);
  return (data ?? []).map((a) => ({
    id: Number(a.id),
    action: a.action as string,
    note: a.note as string,
    at: a.created_at as string,
    staff: a.staff_id ? people.get(a.staff_id) : undefined,
    target: a.target_user ? people.get(a.target_user) : undefined,
    reportId: a.report_id as string | null,
  }));
}
