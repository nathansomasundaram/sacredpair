"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireVerifiedMember } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "./data";
import { processPhoto } from "./photo";
import { profileOverviewSchema } from "./schemas";

export type ProfileFormState = {
  status: "idle" | "error";
  fieldErrors?: Record<string, string>;
  formError?: string;
  values?: {
    displayName: string;
    city: string;
    stateCode: string;
    aboutMe: string;
    traits: string[];
  };
};

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function saveProfileOverview(
  _: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const user = await requireVerifiedMember("/profile/edit");
  const values = {
    displayName: text(form, "displayName"),
    city: text(form, "city"),
    stateCode: text(form, "stateCode"),
    aboutMe: text(form, "aboutMe"),
    traits: form
      .getAll("traits")
      .filter((v): v is string => typeof v === "string"),
  };
  const parsed = profileOverviewSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      city: parsed.data.city,
      state_code: parsed.data.stateCode,
      country_code: "US",
      about_me: parsed.data.aboutMe,
      traits: parsed.data.traits,
    })
    .eq("id", user.id);
  if (error) {
    console.error("Profile save failed", error);
    return { status: "error", formError: "saveFailed", values };
  }

  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export type PhotoState = {
  status: "idle" | "error" | "success";
  error?: string;
};

/** Checks, cleans and stores the member's picture, replacing the old one. */
export async function uploadProfilePhoto(
  _: PhotoState,
  form: FormData,
): Promise<PhotoState> {
  const user = await requireVerifiedMember("/profile/edit");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "photoNotImage" };
  }

  const result = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) return { status: "error", error: result.error };

  const admin = createAdminClient();
  // Random file names, inside the member's own folder.
  const path = `${user.id}/${randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, result.data, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    console.error("Photo upload failed", uploadError);
    return { status: "error", error: "photoFailed" };
  }

  const { data: before } = await admin
    .from("profiles")
    .select("primary_photo_path")
    .eq("id", user.id)
    .single();

  const { error: saveError } = await admin
    .from("profiles")
    .update({ primary_photo_path: path })
    .eq("id", user.id);
  if (saveError) {
    await admin.storage.from(PHOTO_BUCKET).remove([path]);
    console.error("Saving photo path failed", saveError);
    return { status: "error", error: "photoFailed" };
  }

  // Remove the previous picture so old photos don't linger.
  const old = before?.primary_photo_path;
  if (old && old !== path && old.startsWith(`${user.id}/`)) {
    await admin.storage.from(PHOTO_BUCKET).remove([old]);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { status: "success" };
}
