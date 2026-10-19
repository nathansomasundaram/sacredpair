// Choices for the Profile Overview. Stored as codes; labels come from
// messages/<locale>.json ("options.traits", "options.usStates"). Keep these
// lists in step with the database constraints in
// supabase/migrations/20261020000000_profile_overview.sql.

export const TRAITS = [
  "kind",
  "honest",
  "loyal",
  "patient",
  "generous",
  "funny",
  "curious",
  "ambitious",
  "calm",
  "adventurous",
  "family_oriented",
  "faithful",
  "thoughtful",
  "creative",
  "optimistic",
  "independent",
  "affectionate",
  "hardworking",
  "organized",
  "outgoing",
  "easygoing",
  "romantic",
  "practical",
  "compassionate",
] as const;
export type Trait = (typeof TRAITS)[number];
export const MAX_TRAITS = 5;

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;
export type UsState = (typeof US_STATES)[number];

export const NAME_MAX = 40;
export const CITY_MAX = 80;
export const ABOUT_MAX = 1000;

// Photos: the browser shrinks large photos before upload, then the server
// re-encodes every photo. These limits apply to what the browser sends.
export const PHOTO_MIN_SIDE = 400;
export const PHOTO_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_PICK_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
