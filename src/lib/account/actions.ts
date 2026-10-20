"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authErrorKey } from "@/lib/auth/errors";
import {
  emailSchema,
  newPasswordSchema,
  normalizePhone,
} from "@/lib/auth/schemas";
import { requireVerifiedMember } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendPhoneCode, verifyPhoneCode } from "./phone";

export type AccountState = {
  ok?: boolean;
  error?: string;
  /** Echoed back so the form shows what was entered. */
  value?: string;
  simulatedCode?: string;
};

/** Starts an email change. Supabase emails a link to confirm it. */
export async function changeEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { error: "emailInvalid", value: raw };
  if (parsed.data === user.email) return { error: "sameEmail", value: raw };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/settings/account` },
  );
  if (error) return { error: authErrorKey(error), value: raw };
  return { ok: true, value: parsed.data };
}

/** Changes the phone number; it needs verifying again afterwards. */
export async function changePhone(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizePhone(raw);
  if (!phone) return { error: "phoneInvalid", value: raw };
  const supabase = await createClient();
  const { error } = await supabase
    .from("account_private")
    .update({ phone })
    .eq("user_id", user.id);
  if (error) return { error: "generic", value: raw };
  revalidatePath("/settings", "layout");
  return { ok: true, value: phone };
}

export async function requestPhoneCode(): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  const r = await sendPhoneCode(user.id);
  if (!r.ok) return { error: r.error };
  return { ok: true, simulatedCode: r.simulatedCode };
}

export async function confirmPhoneCode(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  const code = String(formData.get("code") ?? "");
  const r = await verifyPhoneCode(user.id, code);
  if (!r.ok) return { error: r.error, value: code };
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/**
 * Changes the password after checking the current one. Signing in again
 * also counts as a recent sign-in, which Supabase requires for this.
 */
export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const parsed = newPasswordSchema.safeParse(next);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "passwordWeak" };
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: current,
  });
  if (signInError) return { error: "currentWrong" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: authErrorKey(error) };
  return { ok: true };
}

/**
 * Deletes the account for good: profile, photos, video, messages, journeys
 * and everything else. Needs the password and typing DELETE.
 */
export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireVerifiedMember("/settings/account");
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "DELETE"
  )
    return { error: "typeDelete" };
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: String(formData.get("password") ?? ""),
  });
  if (signInError) return { error: "currentWrong" };

  const admin = createAdminClient();
  // Remove their files first; the database rows go with the account.
  for (const bucket of ["photos", "videos"]) {
    try {
      const { data } = await admin.storage
        .from(bucket)
        .list(user.id, { limit: 1000 });
      const files = (data ?? []).map((f) => `${user.id}/${f.name}`);
      if (files.length > 0) await admin.storage.from(bucket).remove(files);
    } catch (e) {
      console.error(`deleteAccount: couldn't list ${bucket}`, e);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteAccount failed", error);
    return { error: "generic" };
  }
  await supabase.auth.signOut();
  redirect("/?notice=accountDeleted");
}
