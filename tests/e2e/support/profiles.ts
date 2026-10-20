import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env";
import { createMember } from "./users";

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function birthdateForAge(age: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}

/** A plain colored square, standing in for a member's photo. */
async function photo(hue: number) {
  return sharp({
    create: {
      width: 400,
      height: 500,
      channels: 3,
      background: `hsl(${hue}, 45%, 55%)`,
    },
  })
    .webp()
    .toBuffer();
}

export type ProfileFields = {
  name?: string;
  age?: number;
  city?: string;
  state?: string;
  aboutMe?: string;
  traits?: string[];
  /** Ages this member wants to meet. */
  ageRange?: [number, number];
  /** Leave the profile without a photo (incomplete). */
  noPhoto?: boolean;
};

/**
 * A verified member with a filled-in Profile Overview, set up directly so
 * tests can start from any point.
 */
export async function createProfile(fields: ProfileFields = {}) {
  const member = await createMember();
  const name = fields.name ?? `Member ${randomUUID().slice(0, 4)}`;
  let photoPath: string | null = null;
  if (!fields.noPhoto) {
    photoPath = `${member.id}/${randomUUID()}.webp`;
    const { error } = await admin.storage
      .from("photos")
      .upload(photoPath, await photo(Math.floor(Math.random() * 360)), {
        contentType: "image/webp",
      });
    if (error) throw error;
  }
  const { error } = await admin
    .from("profiles")
    .update({
      display_name: name,
      city: fields.city ?? "Raleigh",
      state_code: fields.state ?? "NC",
      about_me: fields.aboutMe ?? "",
      traits: fields.traits ?? [],
      primary_photo_path: photoPath,
      ...(fields.age ? { birthdate: birthdateForAge(fields.age) } : {}),
    })
    .eq("id", member.id);
  if (error) throw error;
  if (fields.ageRange) {
    const { error: e } = await admin
      .from("preferences")
      .update({ age_min: fields.ageRange[0], age_max: fields.ageRange[1] })
      .eq("profile_id", member.id);
    if (e) throw e;
  }
  return { ...member, name };
}

export async function deleteMembers(ids: string[]) {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}

/** A town name no other test uses, so a test's members meet each other first. */
export function uniqueCity() {
  return `Testville ${randomUUID().slice(0, 6)}`;
}

/** Fills in someone's Premium profile: 2 more photos, a video, a prompt and details. */
export async function addPremiumContent(id: string) {
  const fs = await import("node:fs");
  const videoPath = `${id}/${randomUUID()}.mp4`;
  const video = await admin.storage
    .from("videos")
    .upload(videoPath, fs.readFileSync("tests/fixtures/location.mp4"), {
      contentType: "video/mp4",
    });
  if (video.error) throw video.error;

  const { error } = await admin
    .from("profile_premium")
    .update({
      height_cm: 178,
      profession: "Choir director",
      religion: "christian",
      family_plan: "want_children",
      hobbies: ["cooking", "hiking"],
      prompts: [
        {
          prompt: "perfect_sunday",
          answer: "Morning service, then a long lunch with friends.",
        },
      ],
      video_path: videoPath,
    })
    .eq("profile_id", id);
  if (error) throw error;

  for (const position of [1, 2]) {
    const path = `${id}/${randomUUID()}.webp`;
    const up = await admin.storage
      .from("photos")
      .upload(path, await photo(position * 90), { contentType: "image/webp" });
    if (up.error) throw up.error;
    const row = await admin
      .from("profile_photos")
      .insert({ profile_id: id, storage_path: path, position });
    if (row.error) throw row.error;
  }
}
