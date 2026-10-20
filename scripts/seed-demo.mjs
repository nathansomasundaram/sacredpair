#!/usr/bin/env node
/**
 * Adds fictional, verified members with complete profiles to your LOCAL
 * Supabase, so Discover has people to introduce while you build and test.
 *
 *   npm run seed:demo            -> adds the demo members (safe to run again)
 *   npm run seed:demo -- --remove  -> removes them
 *
 * Only runs against a local Supabase (localhost / 127.0.0.1). Every demo
 * member's email ends in @demo.sacredpair.test and their password is printed
 * at the end, so you can also log in as them.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

const PASSWORD = "DemoMember2026";
const DOMAIN = "demo.sacredpair.test";

// Fictional people. Cities spread across a few states so "nearest first"
// ordering is visible.
const MEMBERS = [
  [
    "Daniel",
    "man",
    43,
    "Raleigh",
    "NC",
    "Teacher who still writes letters by hand. Sunday dinners, long walks, and a good mystery novel.",
    ["kind", "patient", "curious"],
  ],
  [
    "Grace",
    "woman",
    38,
    "Raleigh",
    "NC",
    "Pediatric nurse, choir alto, and the friend who remembers everyone's birthday.",
    ["kind", "generous", "faithful"],
  ],
  [
    "Marcus",
    "man",
    39,
    "Durham",
    "NC",
    "Coach and youth mentor. Terrible at mini golf, great at pancakes.",
    ["funny", "loyal", "ambitious"],
  ],
  [
    "Naomi",
    "woman",
    41,
    "Durham",
    "NC",
    "Architect who sketches every bridge she crosses. Looking for a partner in quiet adventures.",
    ["curious", "calm", "honest"],
  ],
  [
    "Elijah",
    "man",
    52,
    "Charlotte",
    "NC",
    "Widower, father of two grown kids, ready for a second chapter.",
    ["honest", "patient", "faithful"],
  ],
  [
    "Ruth",
    "woman",
    49,
    "Charlotte",
    "NC",
    "Small-business owner, gardener, and an unapologetic early riser.",
    ["generous", "loyal", "calm"],
  ],
  [
    "Samuel",
    "man",
    36,
    "Atlanta",
    "GA",
    "Engineer by day, woodworker by weekend. I'll build you a bookshelf.",
    ["curious", "kind", "ambitious"],
  ],
  [
    "Leah",
    "woman",
    34,
    "Atlanta",
    "GA",
    "Pharmacist and amateur baker. My sourdough has a name.",
    ["funny", "honest", "kind"],
  ],
  [
    "Jordan",
    "non_binary",
    33,
    "Richmond",
    "VA",
    "Librarian, hiker, and collector of very old maps.",
    ["curious", "adventurous", "calm"],
  ],
  [
    "Isaac",
    "man",
    46,
    "Columbia",
    "SC",
    "Pastor's kid turned accountant. Family, faith and Friday-night board games.",
    ["loyal", "faithful", "patient"],
  ],
  [
    "Hannah",
    "woman",
    29,
    "Greenville",
    "SC",
    "Physical therapist who runs half-marathons for the post-race brunch.",
    ["adventurous", "funny", "generous"],
  ],
  [
    "Caleb",
    "man",
    31,
    "Nashville",
    "TN",
    "Session guitarist with a soft spot for rescue dogs.",
    ["kind", "funny", "loyal"],
  ],
];

function birthdateForAge(age) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return d.toISOString().slice(0, 10);
}

/** An abstract portrait-shaped image: soft gradient with two rings. */
async function demoPhoto(i) {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},45%,62%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},40%,38%)"/>
    </linearGradient></defs>
    <rect width="800" height="1000" fill="url(#g)"/>
    <circle cx="350" cy="500" r="120" fill="none" stroke="white" stroke-opacity=".55" stroke-width="22"/>
    <circle cx="450" cy="500" r="120" fill="none" stroke="white" stroke-opacity=".55" stroke-width="22"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

async function existingDemoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    users.push(...data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  return users;
}

if (process.argv.includes("--remove")) {
  const users = await existingDemoUsers();
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  console.log(`Removed ${users.length} demo members.`);
  process.exit(0);
}

const existing = new Set((await existingDemoUsers()).map((u) => u.email));
let added = 0;
for (const [
  i,
  [name, gender, age, city, state, about, traits],
] of MEMBERS.entries()) {
  const email = `${name.toLowerCase()}@${DOMAIN}`;
  if (existing.has(email)) continue;

  const birthdate = birthdateForAge(age);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { birthdate, accepted_terms: true },
    app_metadata: { id_verified: true },
  });
  if (error) throw error;
  const id = data.user.id;

  const photoPath = `${id}/demo-${i}.webp`;
  const upload = await admin.storage
    .from("photos")
    .upload(photoPath, await demoPhoto(i), { contentType: "image/webp" });
  if (upload.error) throw upload.error;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      display_name: name,
      gender,
      birthdate,
      city,
      state_code: state,
      about_me: about,
      traits,
      primary_photo_path: photoPath,
      id_verified_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (profileError) throw profileError;
  added++;
}

console.log(
  `Added ${added} demo members (${MEMBERS.length - added} were already there).\n` +
    `Log in as any of them with <first name>@${DOMAIN} and password ${PASSWORD}.`,
);
