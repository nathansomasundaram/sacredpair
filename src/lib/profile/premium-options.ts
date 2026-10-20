// Choices for the Profile - Premium fields. Stored as codes; labels live in
// messages/<locale>.json under "options.<field>" (languages use the
// browser's built-in language names). The database accepts only these codes:
// see supabase/migrations/20261021000000_profile_premium.sql. When adding a
// code, add it here, in the messages file and in a new migration.

export const SINGLE_CHOICE = {
  zodiac: [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
  ],
  religion: [
    "christian",
    "catholic",
    "orthodox_christian",
    "latter_day_saints",
    "muslim",
    "jewish",
    "hindu",
    "buddhist",
    "sikh",
    "spiritual",
    "agnostic",
    "atheist",
    "other",
    "prefer_not",
  ],
  ethnicity: [
    "asian",
    "black",
    "hispanic_latino",
    "middle_eastern",
    "native_american",
    "pacific_islander",
    "south_asian",
    "white",
    "multiracial",
    "other",
    "prefer_not",
  ],
  marital_status: ["never_married", "divorced", "separated", "widowed"],
  children: ["none", "have_live_with_me", "have_live_elsewhere"],
  family_plan: [
    "want_children",
    "open_to_children",
    "dont_want_children",
    "not_sure",
  ],
  education: [
    "high_school",
    "trade_school",
    "some_college",
    "associate",
    "bachelor",
    "master",
    "doctorate",
  ],
  smoking: ["never", "socially", "regularly", "trying_to_quit"],
  drinking: ["never", "socially", "regularly", "sober"],
  workout: ["never", "sometimes", "often", "daily"],
} as const;

export const MULTI_CHOICE = {
  // ISO 639-1 codes; names come from Intl.DisplayNames in the viewer's language.
  languages: [
    "en",
    "es",
    "zh",
    "tl",
    "vi",
    "ar",
    "fr",
    "ko",
    "ru",
    "de",
    "hi",
    "pt",
    "it",
    "ja",
    "pl",
    "ur",
    "fa",
    "bn",
    "pa",
    "gu",
    "ht",
    "el",
    "he",
    "sw",
    "yo",
    "am",
    "asl",
  ],
  pets: [
    "dog",
    "cat",
    "bird",
    "fish",
    "reptile",
    "small_pets",
    "no_pets",
    "allergic",
  ],
  hobbies: [
    "cooking",
    "baking",
    "gardening",
    "photography",
    "painting",
    "writing",
    "reading",
    "volunteering",
    "crafts",
    "dancing",
    "hiking",
    "camping",
    "fishing",
    "board_games",
    "diy",
    "gaming",
  ],
  sports: [
    "running",
    "cycling",
    "swimming",
    "basketball",
    "football",
    "soccer",
    "baseball",
    "tennis",
    "golf",
    "yoga",
    "martial_arts",
    "skiing",
    "volleyball",
    "pickleball",
  ],
  food_and_drink: [
    "coffee",
    "tea",
    "wine",
    "craft_beer",
    "home_cooking",
    "trying_restaurants",
    "street_food",
    "vegetarian",
    "vegan",
    "spicy_food",
    "desserts",
    "brunch",
  ],
  entertainment: [
    "movies",
    "tv_series",
    "live_music",
    "theater",
    "comedy",
    "museums",
    "podcasts",
    "documentaries",
    "anime",
    "video_games",
    "festivals",
    "sports_events",
  ],
  travel: [
    "beaches",
    "mountains",
    "city_breaks",
    "road_trips",
    "camping_trips",
    "cruises",
    "backpacking",
    "international",
    "national_parks",
    "staying_local",
  ],
  music: [
    "pop",
    "rock",
    "hip_hop",
    "rnb",
    "country",
    "jazz",
    "classical",
    "gospel",
    "worship",
    "latin",
    "electronic",
    "indie",
    "kpop",
    "afrobeats",
  ],
  books: [
    "fiction",
    "mystery",
    "romance",
    "sci_fi",
    "fantasy",
    "biography",
    "history",
    "self_help",
    "faith_spirituality",
    "poetry",
    "business",
    "comics",
  ],
} as const;

export type SingleChoiceField = keyof typeof SINGLE_CHOICE;
export type MultiChoiceField = keyof typeof MULTI_CHOICE;

/** Most choices a member can pick in each list. */
export const MULTI_MAX: Record<MultiChoiceField, number> = {
  languages: 6,
  pets: 4,
  hobbies: 6,
  sports: 6,
  food_and_drink: 6,
  entertainment: 6,
  travel: 6,
  music: 6,
  books: 6,
};

export const PROMPTS = [
  "perfect_sunday",
  "values_most",
  "friends_describe",
  "faith_means",
  "together_we_could",
  "dealbreaker",
  "love_language",
  "proudest_of",
  "green_flag",
  "learning_now",
] as const;
export type PromptCode = (typeof PROMPTS)[number];
export const MAX_PROMPTS = 3;
export const PROMPT_ANSWER_MAX = 200;

export const PROFESSION_MAX = 80;

// Height is stored in centimetres; US English shows feet and inches.
export const HEIGHT_MIN_CM = 120;
export const HEIGHT_MAX_CM = 230;

export const MAX_EXTRA_PHOTOS = 6;

// Video: MP4 or MOV, up to 60 seconds and 50 MB, uploaded straight to
// storage, then checked and cleaned by the server.
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_ACCEPT = "video/mp4,video/quicktime";
