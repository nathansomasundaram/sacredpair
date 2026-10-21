import "server-only";
import { notFound } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "moderator";
export type Staff = SessionUser & { role: StaffRole };

export async function staffRole(userId: string): Promise<StaffRole | null> {
  const { data } = await createAdminClient().from("staff").select("role").eq("user_id", userId).maybeSingle();
  return (data?.role as StaffRole | undefined) ?? null;
}

/**
 * For moderation pages and actions. Anyone who isn't staff gets a plain
 * "not found", so the moderation area doesn't reveal that it exists.
 */
export async function requireStaff(): Promise<Staff> {
  const user = await getSessionUser();
  if (!user || user.suspended) notFound();
  const role = await staffRole(user.id);
  if (!role) notFound();
  return { ...user, role };
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") notFound();
  return staff;
}
