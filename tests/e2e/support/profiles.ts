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

/** Introduces `target` to `viewer` this week, as the magic wand would. */
export async function introduce(viewer: string, target: string) {
  const { data: week, error: weekError } = await admin.rpc("discovery_week");
  if (weekError) throw weekError;
  const weekStart = String(week).slice(0, 10);
  let { data: batch } = await admin
    .from("discovery_batches")
    .select("id")
    .eq("user_id", viewer)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!batch) {
    const made = await admin
      .from("discovery_batches")
      .insert({ user_id: viewer, week_start: weekStart })
      .select("id")
      .single();
    if (made.error) throw made.error;
    batch = made.data;
  }
  const { data: items } = await admin
    .from("discovery_batch_items")
    .select("profile_id")
    .eq("batch_id", batch!.id);
  const { error } = await admin.from("discovery_batch_items").insert({
    batch_id: batch!.id,
    profile_id: target,
    position: (items?.length ?? 0) + 1,
  });
  if (error) throw error;
}

/** Two members who were introduced and chose each other: connected. */
export async function connect(a: string, b: string) {
  await introduce(a, b);
  await introduce(b, a);
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    const { error } = await admin
      .from("choices")
      .insert({ from_id: from, to_id: to, chosen: true });
    if (error) throw error;
  }
  const { data, error } = await admin
    .from("connections")
    .select("id")
    .eq("user_a", a < b ? a : b)
    .eq("user_b", a < b ? b : a)
    .is("ended_at", null)
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Reports filed by a member (for checking what the moderation team gets). */
export async function reportsBy(reporter: string) {
  const { data, error } = await admin
    .from("reports")
    .select("reported_id, reason, details, connection_id")
    .eq("reporter_id", reporter);
  if (error) throw error;
  return data;
}

/** Makes a member Premium (test mode), as the upgrade screen would. */
export async function makePremium(id: string) {
  const { error } = await admin
    .from("entitlements")
    .update({ tier: "premium", source: "simulated", expires_at: null })
    .eq("user_id", id);
  if (error) throw error;
}

/** Notifications the server recorded for a member, newest first. */
export async function notificationsFor(id: string) {
  const { data, error } = await admin
    .from("notification_log")
    .select("channel, topic, status")
    .eq("user_id", id)
    .order("id", { ascending: false });
  if (error) throw error;
  return data;
}

/** A member's private settings, as stored. */
export async function privateSettings(id: string) {
  const [{ data: prefs }, { data: priv }, { data: profile }] =
    await Promise.all([
      admin.from("preferences").select("*").eq("profile_id", id).single(),
      admin
        .from("account_private")
        .select("zip_code, latitude, longitude, phone, phone_verified_at")
        .eq("user_id", id)
        .single(),
      admin.from("profiles").select("gender, is_visible").eq("id", id).single(),
    ]);
  return { prefs: prefs!, priv: priv!, profile: profile! };
}

/** Sets a verified phone number and turns on text notifications. */
export async function verifiedPhone(id: string, phone = "+15555550123") {
  // Two steps: changing the number always clears its verification.
  const a = await admin
    .from("account_private")
    .update({ phone })
    .eq("user_id", id);
  if (a.error) throw a.error;
  const v = await admin
    .from("account_private")
    .update({ phone_verified_at: new Date().toISOString() })
    .eq("user_id", id);
  if (v.error) throw v.error;
  const b = await admin
    .from("preferences")
    .update({ notify_sms: true })
    .eq("profile_id", id);
  if (b.error) throw b.error;
}

export async function userExists(id: string) {
  const { data } = await admin.auth.admin.getUserById(id);
  return !!data?.user;
}

/** Gives someone access to the moderation area. */
export async function makeStaff(id: string, role: "admin" | "moderator" = "admin") {
  const { error } = await admin.from("staff").upsert({ user_id: id, role }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Files a report as a member would. */
export async function fileReport(reporter: string, reported: string, connectionId: string | null, details = "") {
  const { data, error } = await admin
    .from("reports")
    .insert({ reporter_id: reporter, reported_id: reported, reason: "harassment", details, connection_id: connectionId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function sendAs(connectionId: string, sender: string, body: string) {
  const { error } = await admin.from("messages").insert({ connection_id: connectionId, sender_id: sender, body });
  if (error) throw error;
}

export async function profileRow(id: string) {
  const { data } = await admin.from("profiles").select("primary_photo_path, banned_at, about_me").eq("id", id).single();
  return data!;
}
