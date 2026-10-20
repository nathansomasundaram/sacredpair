"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireVerifiedMember } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "./data";
import { processPhoto } from "./photo";
import { VIDEO_BUCKET } from "./premium-data";
import {
  MAX_EXTRA_PHOTOS,
  MULTI_CHOICE,
  SINGLE_CHOICE,
  VIDEO_ACCEPT,
  VIDEO_MAX_BYTES,
} from "./premium-options";
import { premiumDetailsSchema, premiumFormToInput } from "./premium-schemas";
import { cleanVideo } from "./video";

const EDIT_PATH = "/profile/premium";
const requireMember = () => requireVerifiedMember(EDIT_PATH);

function refresh() {
  revalidatePath("/profile");
  revalidatePath(EDIT_PATH);
}

// --- Details ---------------------------------------------------------------

export type PremiumFormState = {
  status: "idle" | "error";
  fieldErrors?: Record<string, string>;
  formError?: string;
};

export async function savePremiumDetails(
  _: PremiumFormState,
  form: FormData,
): Promise<PremiumFormState> {
  const user = await requireMember();
  const parsed = premiumDetailsSchema.safeParse(premiumFormToInput(form));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const d = parsed.data;
  const row: Record<string, unknown> = {
    height_cm: d.heightCm,
    profession: d.profession,
    prompts: d.prompts,
  };
  for (const f of Object.keys(SINGLE_CHOICE)) row[f] = d[f as keyof typeof d];
  for (const f of Object.keys(MULTI_CHOICE)) row[f] = d[f as keyof typeof d];

  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_premium")
    .update(row)
    .eq("profile_id", user.id);
  if (error) {
    console.error("Saving Premium details failed", error);
    return { status: "error", formError: "saveFailed" };
  }
  refresh();
  redirect("/profile?saved=premium");
}

// --- Extra photos ----------------------------------------------------------

export type MediaState = {
  status: "idle" | "error" | "success";
  error?: string;
};

export async function addExtraPhoto(
  _: MediaState,
  form: FormData,
): Promise<MediaState> {
  const user = await requireMember();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "photoNotImage" };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profile_photos")
    .select("position")
    .eq("profile_id", user.id);
  const positions = (existing ?? []).map(
    (r: { position: number }) => r.position,
  );
  if (positions.length >= MAX_EXTRA_PHOTOS)
    return { status: "error", error: "tooManyPhotos" };

  const result = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) return { status: "error", error: result.error };

  const path = `${user.id}/${randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, result.data, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    console.error("Extra photo upload failed", uploadError);
    return { status: "error", error: "photoFailed" };
  }

  const { error } = await admin.from("profile_photos").insert({
    profile_id: user.id,
    storage_path: path,
    position: Math.max(0, ...positions) + 1,
  });
  if (error) {
    await admin.storage.from(PHOTO_BUCKET).remove([path]);
    return {
      status: "error",
      error:
        error.message === "too_many_photos" ? "tooManyPhotos" : "photoFailed",
    };
  }
  refresh();
  return { status: "success" };
}

export async function removeExtraPhoto(form: FormData) {
  const user = await requireMember();
  const id = String(form.get("photoId") ?? "");
  const admin = createAdminClient();
  const { data } = await admin
    .from("profile_photos")
    .select("storage_path")
    .eq("id", id)
    .eq("profile_id", user.id);
  const row = (data as { storage_path: string }[] | null)?.[0];
  if (row) {
    await admin
      .from("profile_photos")
      .delete()
      .eq("id", id)
      .eq("profile_id", user.id);
    await admin.storage.from(PHOTO_BUCKET).remove([row.storage_path]);
  }
  refresh();
}

// --- Video -----------------------------------------------------------------
//
// Videos are too big to pass through the app server (hosting limits uploads
// to a few megabytes), so the browser uploads straight to private storage
// with a one-time link. The server then checks and cleans the file.

export async function requestVideoUpload(input: {
  size: number;
  type: string;
}): Promise<{ path: string; token: string } | { error: string }> {
  const user = await requireMember();
  if (!VIDEO_ACCEPT.split(",").includes(input.type))
    return { error: "videoNotSupported" };
  if (!(input.size > 0) || input.size > VIDEO_MAX_BYTES)
    return { error: "videoTooLarge" };

  const path = `${user.id}/incoming/${randomUUID()}`;
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Could not create video upload link", error);
    return { error: "videoFailed" };
  }
  return { path, token: data.token };
}

export async function finishVideoUpload(path: string): Promise<MediaState> {
  const user = await requireMember();
  const prefix = `${user.id}/incoming/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    return { status: "error", error: "videoFailed" };
  }

  const admin = createAdminClient();
  const bucket = admin.storage.from(VIDEO_BUCKET);
  try {
    const { data: blob, error: downloadError } = await bucket.download(path);
    if (downloadError || !blob)
      return { status: "error", error: "videoFailed" };

    const result = cleanVideo(Buffer.from(await blob.arrayBuffer()));
    if (!result.ok) return { status: "error", error: result.error };

    const finalPath = `${user.id}/${randomUUID()}.${result.mimeType === "video/quicktime" ? "mov" : "mp4"}`;
    const { error: uploadError } = await bucket.upload(finalPath, result.data, {
      contentType: result.mimeType,
      upsert: false,
    });
    if (uploadError) return { status: "error", error: "videoFailed" };

    const { data: before } = await admin
      .from("profile_premium")
      .select("video_path")
      .eq("profile_id", user.id);
    const old = (before as { video_path: string | null }[] | null)?.[0]
      ?.video_path;

    const { error: saveError } = await admin
      .from("profile_premium")
      .update({ video_path: finalPath })
      .eq("profile_id", user.id);
    if (saveError) {
      await bucket.remove([finalPath]);
      return { status: "error", error: "videoFailed" };
    }
    if (old && old.startsWith(`${user.id}/`)) await bucket.remove([old]);
  } finally {
    // The uncleaned upload is never kept.
    await bucket.remove([path]);
  }

  refresh();
  return { status: "success" };
}

export async function removeVideo() {
  const user = await requireMember();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profile_premium")
    .select("video_path")
    .eq("profile_id", user.id);
  const old = (data as { video_path: string | null }[] | null)?.[0]?.video_path;
  await admin
    .from("profile_premium")
    .update({ video_path: null })
    .eq("profile_id", user.id);
  if (old && old.startsWith(`${user.id}/`)) {
    await admin.storage.from(VIDEO_BUCKET).remove([old]);
  }
  refresh();
}
