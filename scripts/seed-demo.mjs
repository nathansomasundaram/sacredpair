#!/usr/bin/env node
/**
 * Fills your LOCAL Supabase with fictional, verified members so you can test
 * Discover, Details and Premium without signing people up by hand.
 *
 *   npm run seed:demo                 add the demo members, or refresh them
 *   npm run seed:demo -- --fresh      also clear the two viewers' introductions,
 *                                     so the magic wand can be used again
 *   npm run seed:demo -- --remove     remove every demo member
 *
 * What you get (see scripts/demo/members.mjs):
 *   - 12 members with complete overviews. Most have full Premium profiles
 *     (extra photos, a video, prompts, details, interests), two have partial
 *     ones and two have none, so every Details state can be seen.
 *   - Two members to log in as: taylor@ (free) and morgan@ (Premium, in test
 *     mode), both @demo.sacredpair.test, so you can compare what each sees.
 *     Each is already connected with two members, with conversations
 *     (some messages unread) to try Chat.
 *
 * Safe to run again: it updates existing demo members instead of duplicating
 * them. Only runs against a local Supabase (localhost / 127.0.0.1).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  CONVERSATIONS,
  DEMO_DOMAIN,
  DEMO_PASSWORD,
  MEMBERS,
  VIEWERS,
} from "./demo/members.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall through to the check below.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error(
    'Supabase settings are missing. Run "npm run env:local" first.',
  );
  process.exit(1);
}
if (
  !/^https?:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?/.test(
    url,
  )
) {
  console.error(`Refusing to add demo members to ${url}: local Supabase only.`);
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VIDEO = fs.readFileSync(new URL("./demo/intro.mp4", import.meta.url));
const emailFor = (name) => `${name.toLowerCase()}@${DEMO_DOMAIN}`;

function check(result, what) {
  if (result.error) {
    console.error(`Couldn't ${what}:`, result.error.message ?? result.error);
    process.exit(1);
  }
  return result.data;
}

function birthdateForAge(age) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return d.toISOString().slice(0, 10);
}

// Abstract pictures (no real people): a portrait-shaped scene per photo.
const SCENES = [
  // Two rings
  (
    a,
    b,
  ) => `<circle cx="340" cy="500" r="130" fill="none" stroke="${b}" stroke-opacity=".7" stroke-width="24"/>
             <circle cx="460" cy="500" r="130" fill="none" stroke="${b}" stroke-opacity=".7" stroke-width="24"/>`,
  // Sun over hills
  (a, b) => `<circle cx="560" cy="330" r="110" fill="${b}" fill-opacity=".85"/>
             <path d="M0 760 Q 200 600 400 720 T 800 680 V1000 H0Z" fill="${a}" fill-opacity=".9"/>`,
  // Waves
  (
    a,
    b,
  ) => `<path d="M0 640 Q 100 590 200 640 T 400 640 T 600 640 T 800 640 V1000 H0Z" fill="${b}" fill-opacity=".55"/>
             <path d="M0 740 Q 100 690 200 740 T 400 740 T 600 740 T 800 740 V1000 H0Z" fill="${a}" fill-opacity=".8"/>`,
  // Mountains
  (
    a,
    b,
  ) => `<path d="M0 820 L260 420 L420 640 L560 470 L800 820 V1000 H0Z" fill="${a}" fill-opacity=".9"/>
             <path d="M260 420 L310 497 L230 470Z" fill="${b}"/>`,
  // Tree
  (a, b) => `<rect x="385" y="560" width="30" height="260" fill="${a}"/>
             <circle cx="400" cy="480" r="170" fill="${b}" fill-opacity=".8"/>`,
  // House
  (
    a,
    b,
  ) => `<rect x="250" y="520" width="300" height="260" fill="${b}" fill-opacity=".85"/>
             <path d="M220 530 L400 380 L580 530Z" fill="${a}"/>
             <rect x="370" y="660" width="60" height="120" fill="${a}"/>`,
];

async function picture(seed, sceneIndex) {
  const hue = (seed * 47) % 360;
  const bg1 = `hsl(${hue},45%,70%)`;
  const bg2 = `hsl(${(hue + 40) % 360},40%,42%)`;
  const a = `hsl(${(hue + 180) % 360},35%,30%)`;
  const b = `hsl(${(hue + 20) % 360},70%,92%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>
    </linearGradient></defs>
    <rect width="800" height="1000" fill="url(#g)"/>
    ${SCENES[sceneIndex % SCENES.length](a, b)}
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

/** Demo files have fixed names, so they can be removed without listing. */
const extraPhotoPaths = (id) =>
  Array.from({ length: 6 }, (_, i) => `${id}/demo-extra-${i + 1}.webp`);

async function listDemoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const data = check(
      await admin.auth.admin.listUsers({ page, perPage: 200 }),
      "list users",
    );
    users.push(
      ...data.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`)),
    );
    if (data.users.length < 200) break;
  }
  return users;
}

if (process.argv.includes("--remove")) {
  const users = await listDemoUsers();
  for (const u of users) {
    await admin.storage
      .from("photos")
      .remove([`${u.id}/demo-main.webp`, ...extraPhotoPaths(u.id)]);
    await admin.storage.from("videos").remove([`${u.id}/demo-intro.mp4`]);
    check(await admin.auth.admin.deleteUser(u.id), `remove ${u.email}`);
  }
  console.log(`Removed ${users.length} demo members.`);
  process.exit(0);
}

const existing = new Map((await listDemoUsers()).map((u) => [u.email, u.id]));

/** Creates the member if needed and fills in their Profile Overview. */
async function upsertMember(m, index) {
  const email = emailFor(m.name);
  const birthdate = birthdateForAge(m.age);
  let id = existing.get(email);
  if (!id) {
    const data = check(
      await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { birthdate, accepted_terms: true },
        app_metadata: { id_verified: true },
      }),
      `create ${email}`,
    );
    id = data.user.id;
  }

  const photoPath = `${id}/demo-main.webp`;
  check(
    await admin.storage
      .from("photos")
      .upload(photoPath, await picture(index, index), {
        contentType: "image/webp",
        upsert: true,
      }),
    `upload ${m.name}'s photo`,
  );

  check(
    await admin
      .from("profiles")
      .update({
        display_name: m.name,
        gender: m.gender,
        birthdate,
        city: m.city,
        state_code: m.state,
        about_me: m.about,
        traits: m.traits,
        primary_photo_path: photoPath,
        id_verified_at: new Date().toISOString(),
      })
      .eq("id", id),
    `update ${m.name}'s profile`,
  );
  return id;
}

const EMPTY_PREMIUM = {
  height_cm: null,
  profession: null,
  zodiac: null,
  religion: null,
  ethnicity: null,
  marital_status: null,
  children: null,
  family_plan: null,
  education: null,
  smoking: null,
  drinking: null,
  workout: null,
  languages: [],
  pets: [],
  hobbies: [],
  sports: [],
  food_and_drink: [],
  entertainment: [],
  travel: [],
  music: [],
  books: [],
  prompts: [],
  video_path: null,
};

/** Replaces the member's Premium profile with the demo content. */
async function setPremium(id, m, index) {
  // Start clean: remove earlier demo photos and video.
  check(
    await admin.from("profile_photos").delete().eq("profile_id", id),
    `clear ${m.name}'s photos`,
  );
  await admin.storage.from("photos").remove(extraPhotoPaths(id));
  await admin.storage.from("videos").remove([`${id}/demo-intro.mp4`]);

  const premium = { ...EMPTY_PREMIUM };
  if (m.premium !== "none") {
    Object.assign(premium, m.details ?? {});
    premium.prompts = (m.prompts ?? []).map(([prompt, answer]) => ({
      prompt,
      answer,
    }));

    for (let i = 0; i < (m.photos ?? 0); i++) {
      const path = `${id}/demo-extra-${i + 1}.webp`;
      check(
        await admin.storage
          .from("photos")
          .upload(path, await picture(index * 7 + i + 3, i + 1), {
            contentType: "image/webp",
            upsert: true,
          }),
        `upload ${m.name}'s extra photo`,
      );
      check(
        await admin
          .from("profile_photos")
          .insert({ profile_id: id, storage_path: path, position: i + 1 }),
        `add ${m.name}'s extra photo`,
      );
    }

    if (m.video) {
      const path = `${id}/demo-intro.mp4`;
      check(
        await admin.storage
          .from("videos")
          .upload(path, VIDEO, { contentType: "video/mp4", upsert: true }),
        `upload ${m.name}'s video`,
      );
      premium.video_path = path;
    }
  }

  check(
    await admin.from("profile_premium").update(premium).eq("profile_id", id),
    `save ${m.name}'s Premium profile`,
  );
}

let added = 0;
for (const [i, m] of MEMBERS.entries()) {
  if (!existing.has(emailFor(m.name))) added++;
  const id = await upsertMember(m, i);
  await setPremium(id, m, i);
}

const viewerIds = [];
for (const [i, v] of VIEWERS.entries()) {
  if (!existing.has(emailFor(v.name))) added++;
  const id = await upsertMember(v, MEMBERS.length + i);
  viewerIds.push(id);
  // Viewers are for logging in as; keep them out of everyone's introductions.
  check(
    await admin.from("profiles").update({ is_visible: false }).eq("id", id),
    `hide ${v.name} from Discover`,
  );
  await setPremium(id, { ...v, premium: "none" }, MEMBERS.length + i);
  check(
    await admin
      .from("entitlements")
      .update(
        v.premiumMember
          ? { tier: "premium", source: "simulated", expires_at: null }
          : { tier: "free", source: null, expires_at: null },
      )
      .eq("user_id", id),
    `set ${v.name}'s membership`,
  );
}

if (process.argv.includes("--fresh")) {
  check(
    await admin.from("discovery_batches").delete().in("user_id", viewerIds),
    "clear the viewers' introductions",
  );
  check(
    await admin.from("choices").delete().in("from_id", viewerIds),
    "clear the viewers' choices",
  );
}

// Demo conversations: recreated from scratch each run, so they always
// look the same (ending a connection is otherwise final).
const idByName = new Map();
for (const m of [...MEMBERS, ...VIEWERS]) {
  idByName.set(m.name, existing.get(emailFor(m.name)) ?? null);
}
for (const u of await listDemoUsers()) {
  const m = [...MEMBERS, ...VIEWERS].find((x) => emailFor(x.name) === u.email);
  if (m) idByName.set(m.name, u.id);
}
for (const convo of CONVERSATIONS) {
  const a = idByName.get(convo.viewer);
  const b = idByName.get(convo.with);
  const [low, high] = a < b ? [a, b] : [b, a];
  check(
    await admin
      .from("connections")
      .delete()
      .eq("user_a", low)
      .eq("user_b", high),
    "clear a demo conversation",
  );
  check(
    await admin
      .from("choices")
      .delete()
      .in("from_id", [a, b])
      .in("to_id", [a, b]),
    "clear demo choices",
  );
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    check(
      await admin
        .from("choices")
        .insert({ from_id: from, to_id: to, chosen: true }),
      "add demo choices",
    );
  }
  const connection = check(
    await admin
      .from("connections")
      .select("id")
      .eq("user_a", low)
      .eq("user_b", high)
      .is("ended_at", null)
      .single(),
    "find a demo connection",
  );
  const theirs = convo.messages.filter(([who]) => who === "them");
  const unreadFrom = theirs.length - convo.unread;
  let seenOfTheirs = 0;
  const rows = convo.messages.map(([who, body, minutesAgo]) => {
    const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const fromThem = who === "them";
    const unread = fromThem && seenOfTheirs++ >= unreadFrom;
    return {
      connection_id: connection.id,
      sender_id: fromThem ? b : a,
      body,
      created_at: at,
      // Messages the viewer sent are read; theirs are read except the last few.
      read_at: unread ? null : at,
    };
  });
  if (rows.length > 0) {
    check(await admin.from("messages").insert(rows), "add demo messages");
  }

  // Their Together journey, if any.
  const j = convo.journey;
  if (j) {
    const journey = check(
      await admin
        .from("journeys")
        .insert({
          connection_id: connection.id,
          path: j.path,
          proposed_by: j.proposedBy === "me" ? a : b,
          accepted_at: j.accepted ? new Date().toISOString() : null,
        })
        .select("id")
        .single(),
      "add a demo journey",
    );
    const progress = [];
    for (const [who, uid] of [
      ["me", a],
      ["them", b],
    ]) {
      for (let level = 1; level <= (j.levels?.[who] ?? 0); level++) {
        progress.push({
          journey_id: journey.id,
          user_id: uid,
          level,
          score: 75 + ((level * 7) % 26),
        });
      }
    }
    if (progress.length > 0) {
      check(
        await admin.from("journey_progress").insert(progress),
        "add demo journey progress",
      );
    }
  }
}

const total = MEMBERS.length + VIEWERS.length;
console.log(`Demo members ready: ${added} added, ${total - added} refreshed.

Log in with password ${DEMO_PASSWORD} as:
  ${emailFor("Taylor")}   free member: sees the Premium teaser and upgrade screen
  ${emailFor("Morgan")}   Premium member: sees full Premium profiles
  <first name>@${DEMO_DOMAIN} for any other demo member (for example ${emailFor("Grace")})

Premium content: ${MEMBERS.filter((m) => m.premium === "full")
  .map((m) => m.name)
  .join(", ")} (full);
${MEMBERS.filter((m) => m.premium === "partial")
  .map((m) => m.name)
  .join(", ")} (partial); ${MEMBERS.filter((m) => m.premium === "none")
  .map((m) => m.name)
  .join(", ")} (none).
Conversations: ${CONVERSATIONS.map((c) => `${c.viewer} & ${c.with}`).join(", ")}.
Together: Morgan & Grace on Grow a tree (Morgan one level ahead); Naomi suggested
Write a book to Morgan; Taylor & Daniel on Build a house (Taylor's turn).
${process.argv.includes("--fresh") ? "Cleared Taylor's and Morgan's introductions: the magic wand works again.\n" : ""}`);
