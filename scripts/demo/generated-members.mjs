/**
 * Extra fictional demo members, spread across the United States, so
 * Discover, distance and filters can be tried with a realistic crowd.
 *
 * 200 members: 4 in each of the 50 states, in two cities per state (two
 * people each), with a real ZIP code for every city. They cover ages 21 to
 * 72, women, men and non-binary members, and a wide range of backgrounds,
 * faiths, family situations, careers and interests. Backgrounds follow the
 * place a little (more Pacific Islander profiles in Hawaii, more Hispanic
 * profiles in New Mexico, and so on) and names, faith, languages and life
 * stage fit together, so profiles read as real people.
 *
 * Everything is generated from a fixed seed, so every run produces exactly
 * the same people with the same details: running the seed again refreshes
 * them instead of adding new ones. Change SEED to get a different crowd.
 *
 * The list is ordered so any prefix is spread out: the first 50 are one per
 * state, the first 100 two per state, and so on (`--extra=50`).
 *
 * Only codes the database accepts are used (see
 * src/lib/profile/premium-options.ts); a unit test checks this.
 */

const SEED = 2026;

/** Small, fast, repeatable random numbers (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 50 states, in alphabetical order by name. */
export const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
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
];

// Two cities in every state, each with a downtown ZIP code. Two members live
// in each city.
export const PLACES = {
  AL: [
    ["Birmingham", "35203"],
    ["Mobile", "36602"],
  ],
  AK: [
    ["Anchorage", "99501"],
    ["Fairbanks", "99703"],
  ],
  AZ: [
    ["Phoenix", "85004"],
    ["Tucson", "85701"],
  ],
  AR: [
    ["Little Rock", "72201"],
    ["Fayetteville", "72701"],
  ],
  CA: [
    ["Los Angeles", "90012"],
    ["San Francisco", "94103"],
  ],
  CO: [
    ["Denver", "80202"],
    ["Colorado Springs", "80903"],
  ],
  CT: [
    ["Hartford", "06103"],
    ["New Haven", "06510"],
  ],
  DE: [
    ["Wilmington", "19801"],
    ["Dover", "19901"],
  ],
  FL: [
    ["Miami", "33130"],
    ["Tampa", "33602"],
  ],
  GA: [
    ["Atlanta", "30303"],
    ["Savannah", "31401"],
  ],
  HI: [
    ["Honolulu", "96813"],
    ["Hilo", "96720"],
  ],
  ID: [
    ["Boise", "83702"],
    ["Idaho Falls", "83402"],
  ],
  IL: [
    ["Chicago", "60601"],
    ["Springfield", "62701"],
  ],
  IN: [
    ["Indianapolis", "46204"],
    ["Fort Wayne", "46802"],
  ],
  IA: [
    ["Des Moines", "50309"],
    ["Cedar Rapids", "52401"],
  ],
  KS: [
    ["Wichita", "67202"],
    ["Topeka", "66603"],
  ],
  KY: [
    ["Louisville", "40202"],
    ["Lexington", "40507"],
  ],
  LA: [
    ["New Orleans", "70112"],
    ["Baton Rouge", "70801"],
  ],
  ME: [
    ["Portland", "04101"],
    ["Bangor", "04401"],
  ],
  MD: [
    ["Baltimore", "21201"],
    ["Annapolis", "21401"],
  ],
  MA: [
    ["Boston", "02108"],
    ["Worcester", "01608"],
  ],
  MI: [
    ["Detroit", "48226"],
    ["Grand Rapids", "49503"],
  ],
  MN: [
    ["Minneapolis", "55401"],
    ["Duluth", "55802"],
  ],
  MS: [
    ["Jackson", "39201"],
    ["Gulfport", "39501"],
  ],
  MO: [
    ["St. Louis", "63101"],
    ["Kansas City", "64106"],
  ],
  MT: [
    ["Billings", "59101"],
    ["Missoula", "59802"],
  ],
  NE: [
    ["Omaha", "68102"],
    ["Lincoln", "68508"],
  ],
  NV: [
    ["Las Vegas", "89101"],
    ["Reno", "89501"],
  ],
  NH: [
    ["Manchester", "03101"],
    ["Concord", "03301"],
  ],
  NJ: [
    ["Newark", "07102"],
    ["Trenton", "08608"],
  ],
  NM: [
    ["Albuquerque", "87102"],
    ["Santa Fe", "87501"],
  ],
  NY: [
    ["New York", "10001"],
    ["Buffalo", "14202"],
  ],
  NC: [
    ["Charlotte", "28202"],
    ["Asheville", "28801"],
  ],
  ND: [
    ["Fargo", "58102"],
    ["Bismarck", "58501"],
  ],
  OH: [
    ["Columbus", "43215"],
    ["Cleveland", "44113"],
  ],
  OK: [
    ["Oklahoma City", "73102"],
    ["Tulsa", "74103"],
  ],
  OR: [
    ["Portland", "97205"],
    ["Eugene", "97401"],
  ],
  PA: [
    ["Philadelphia", "19103"],
    ["Pittsburgh", "15222"],
  ],
  RI: [
    ["Providence", "02903"],
    ["Newport", "02840"],
  ],
  SC: [
    ["Charleston", "29401"],
    ["Myrtle Beach", "29577"],
  ],
  SD: [
    ["Sioux Falls", "57104"],
    ["Rapid City", "57701"],
  ],
  TN: [
    ["Memphis", "38103"],
    ["Knoxville", "37902"],
  ],
  TX: [
    ["Houston", "77002"],
    ["San Antonio", "78205"],
  ],
  UT: [
    ["Salt Lake City", "84101"],
    ["Provo", "84601"],
  ],
  VT: [
    ["Burlington", "05401"],
    ["Montpelier", "05602"],
  ],
  VA: [
    ["Arlington", "22201"],
    ["Virginia Beach", "23451"],
  ],
  WA: [
    ["Seattle", "98101"],
    ["Spokane", "99201"],
  ],
  WV: [
    ["Charleston", "25301"],
    ["Morgantown", "26505"],
  ],
  WI: [
    ["Milwaukee", "53202"],
    ["Madison", "53703"],
  ],
  WY: [
    ["Cheyenne", "82001"],
    ["Casper", "82601"],
  ],
};

// First names by background and gender. All different from each other and
// from the hand-written demo members, because a member's email comes from
// their first name.
const WOMEN = {
  white: [
    "Abigail",
    "Allison",
    "Amanda",
    "Amy",
    "Anna",
    "Ashley",
    "Beth",
    "Brittany",
    "Carol",
    "Caroline",
    "Catherine",
    "Charlotte",
    "Christine",
    "Claire",
    "Courtney",
    "Diane",
    "Elizabeth",
    "Emily",
    "Emma",
    "Erin",
    "Frances",
    "Gretchen",
    "Heather",
    "Helen",
    "Holly",
    "Jennifer",
    "Jessica",
    "Joanna",
    "Julia",
    "Katherine",
    "Kelsey",
    "Kimberly",
    "Kristen",
    "Laura",
    "Lauren",
    "Lindsey",
    "Linda",
    "Madison",
    "Margaret",
    "Marilyn",
    "Megan",
    "Melissa",
    "Michelle",
    "Molly",
    "Nancy",
    "Natalie",
    "Nicole",
    "Olivia",
    "Paige",
    "Patricia",
    "Rachel",
    "Rebecca",
    "Ruby",
    "Sarah",
    "Savannah",
    "Sophie",
    "Stephanie",
    "Susan",
    "Tiffany",
    "Victoria",
  ],
  hispanic_latino: [
    "Adriana",
    "Alejandra",
    "Ana",
    "Beatriz",
    "Camila",
    "Carmen",
    "Carolina",
    "Daniela",
    "Elena",
    "Esperanza",
    "Gabriela",
    "Isabel",
    "Juanita",
    "Lucia",
    "Luz",
    "Mariana",
    "Maria",
    "Marisol",
    "Paloma",
    "Rosa",
    "Sofia",
    "Valentina",
    "Ximena",
    "Yesenia",
  ],
  black: [
    "Aaliyah",
    "Andrea",
    "Brianna",
    "Danielle",
    "Deja",
    "Ebony",
    "Imani",
    "Jasmine",
    "Keisha",
    "Kiara",
    "Latoya",
    "Maya",
    "Monique",
    "Nia",
    "Octavia",
    "Renee",
    "Shanice",
    "Simone",
    "Tamika",
    "Tanya",
    "Yolanda",
    "Zaria",
  ],
  asian: [
    "Aiko",
    "Hana",
    "Jisoo",
    "Lin",
    "Ling",
    "Linh",
    "Mai",
    "Mei",
    "Min",
    "Sakura",
    "Thao",
    "Yuki",
  ],
  south_asian: [
    "Anika",
    "Anjali",
    "Divya",
    "Kavya",
    "Meera",
    "Neha",
    "Priya",
    "Sunita",
  ],
  middle_eastern: [
    "Fatima",
    "Layla",
    "Leila",
    "Noor",
    "Rania",
    "Samira",
    "Yasmin",
  ],
  native_american: ["Aiyana", "Kaya", "Nizhoni", "Tala", "Winona"],
  pacific_islander: ["Kalani", "Lani", "Leilani", "Malia", "Moana", "Noelani"],
};

const MEN = {
  white: [
    "Andrew",
    "Austin",
    "Brett",
    "Brian",
    "Bruce",
    "Calvin",
    "Cameron",
    "Christopher",
    "Connor",
    "Craig",
    "Douglas",
    "Dylan",
    "Edward",
    "Eric",
    "Evan",
    "Frank",
    "Gavin",
    "George",
    "Gregory",
    "Harold",
    "Henry",
    "Jack",
    "Jacob",
    "Jason",
    "Jeffrey",
    "Joel",
    "John",
    "Jonathan",
    "Joshua",
    "Justin",
    "Keith",
    "Kyle",
    "Logan",
    "Lucas",
    "Mark",
    "Matthew",
    "Michael",
    "Nathan",
    "Neil",
    "Noah",
    "Owen",
    "Patrick",
    "Paul",
    "Peter",
    "Philip",
    "Richard",
    "Robert",
    "Ryan",
    "Scott",
    "Sean",
    "Stephen",
    "Steven",
    "Timothy",
    "Todd",
    "Trevor",
    "Tyler",
    "Walter",
    "Wesley",
    "William",
    "Zachary",
  ],
  hispanic_latino: [
    "Alejandro",
    "Andres",
    "Antonio",
    "Carlos",
    "Diego",
    "Eduardo",
    "Emilio",
    "Fernando",
    "Gustavo",
    "Hector",
    "Javier",
    "Jorge",
    "Juan",
    "Luis",
    "Manuel",
    "Mateo",
    "Miguel",
    "Pablo",
    "Rafael",
    "Ricardo",
    "Rodrigo",
    "Santiago",
    "Sergio",
    "Victor",
  ],
  black: [
    "Andre",
    "Cedric",
    "Curtis",
    "Darnell",
    "Deandre",
    "Desmond",
    "Isaiah",
    "Jabari",
    "Jamal",
    "Jerome",
    "Kareem",
    "Lamar",
    "Malik",
    "Marcellus",
    "Maurice",
    "Rashad",
    "Reggie",
    "Terrell",
    "Terrence",
    "Trevon",
    "Tyrone",
    "Xavier",
  ],
  asian: [
    "Anh",
    "Chen",
    "Daisuke",
    "Haruto",
    "Hiro",
    "Jin",
    "Jun",
    "Kenji",
    "Minh",
    "Sung",
    "Tuan",
    "Wei",
  ],
  south_asian: [
    "Amit",
    "Arjun",
    "Dev",
    "Nikhil",
    "Raj",
    "Rohan",
    "Sanjay",
    "Vikram",
  ],
  middle_eastern: [
    "Ahmed",
    "Hassan",
    "Karim",
    "Omar",
    "Samir",
    "Tariq",
    "Yusuf",
  ],
  native_american: ["Ahanu", "Chayton", "Nayati", "Takoda", "Waya"],
  pacific_islander: ["Alika", "Kai", "Keanu", "Kekoa", "Koa", "Makoa"],
};

const NON_BINARY = [
  "Emerson",
  "Finley",
  "Harper",
  "Quinn",
  "Riley",
  "Rowan",
  "Sage",
  "Skyler",
];

// How likely each background is, before the state changes it.
const ETHNICITY_BASE = [
  ["white", 52],
  ["hispanic_latino", 15],
  ["black", 13],
  ["asian", 6],
  ["south_asian", 4],
  ["middle_eastern", 2],
  ["native_american", 1],
  ["pacific_islander", 1],
  ["multiracial", 6],
];

// Multipliers for places where a group is much more (or less) common.
const ETHNICITY_BY_STATE = {
  HI: {
    pacific_islander: 14,
    asian: 7,
    multiracial: 3,
    white: 0.3,
    black: 0.3,
  },
  NM: { hispanic_latino: 3, native_american: 10, black: 0.3 },
  AK: { native_american: 14, pacific_islander: 3, asian: 2 },
  CA: { hispanic_latino: 2, asian: 3, south_asian: 1.5 },
  TX: { hispanic_latino: 2.2, black: 1.1 },
  AZ: { hispanic_latino: 2, native_american: 4 },
  NV: { hispanic_latino: 1.8, asian: 2, pacific_islander: 2 },
  FL: { hispanic_latino: 2.2, black: 1.2 },
  NY: { asian: 2, south_asian: 2, hispanic_latino: 1.4, black: 1.2 },
  NJ: { asian: 2, south_asian: 3, hispanic_latino: 1.4 },
  IL: { asian: 1.5, hispanic_latino: 1.3, black: 1.3 },
  WA: { asian: 2.5, pacific_islander: 2 },
  VA: { asian: 1.5, black: 1.6 },
  MD: { black: 2.2, south_asian: 1.5 },
  GA: { black: 2.2 },
  MS: { black: 2.6 },
  AL: { black: 2.2 },
  LA: { black: 2.3 },
  SC: { black: 2.2 },
  NC: { black: 1.7 },
  TN: { black: 1.4 },
  AR: { black: 1.5 },
  MI: { middle_eastern: 5, black: 1.5 },
  OK: { native_american: 8, black: 0.8 },
  SD: { native_american: 8 },
  ND: { native_american: 5 },
  MT: { native_american: 5 },
  MN: { asian: 1.5, black: 0.7 },
  UT: { pacific_islander: 3, hispanic_latino: 0.7 },
  VT: { white: 1.4, black: 0.2, hispanic_latino: 0.3 },
  ME: { white: 1.4, black: 0.2, hispanic_latino: 0.3 },
  NH: { white: 1.3, black: 0.2, hispanic_latino: 0.4 },
  WV: { white: 1.4, black: 0.3, hispanic_latino: 0.2 },
  IA: { white: 1.3, black: 0.4 },
  WY: { white: 1.3, black: 0.2 },
  ID: { white: 1.3, black: 0.2, hispanic_latino: 0.7 },
};

// Faith by background (codes, with weights).
const RELIGION = {
  white: [
    ["christian", 34],
    ["catholic", 16],
    ["latter_day_saints", 2],
    ["jewish", 3],
    ["orthodox_christian", 1],
    ["buddhist", 1],
    ["spiritual", 8],
    ["agnostic", 10],
    ["atheist", 8],
    ["other", 3],
    ["prefer_not", 5],
  ],
  hispanic_latino: [
    ["catholic", 48],
    ["christian", 24],
    ["latter_day_saints", 2],
    ["spiritual", 6],
    ["agnostic", 6],
    ["atheist", 4],
    ["other", 2],
    ["prefer_not", 6],
  ],
  black: [
    ["christian", 62],
    ["catholic", 6],
    ["muslim", 6],
    ["spiritual", 9],
    ["agnostic", 5],
    ["atheist", 3],
    ["other", 2],
    ["prefer_not", 4],
  ],
  asian: [
    ["buddhist", 24],
    ["christian", 22],
    ["catholic", 10],
    ["hindu", 3],
    ["spiritual", 8],
    ["agnostic", 10],
    ["atheist", 12],
    ["prefer_not", 6],
  ],
  south_asian: [
    ["hindu", 42],
    ["muslim", 18],
    ["sikh", 10],
    ["christian", 10],
    ["other", 2],
    ["spiritual", 5],
    ["agnostic", 6],
    ["atheist", 4],
    ["prefer_not", 3],
  ],
  middle_eastern: [
    ["muslim", 50],
    ["christian", 14],
    ["orthodox_christian", 8],
    ["jewish", 6],
    ["agnostic", 8],
    ["atheist", 6],
    ["prefer_not", 8],
  ],
  native_american: [
    ["christian", 36],
    ["catholic", 14],
    ["spiritual", 30],
    ["other", 8],
    ["agnostic", 6],
    ["prefer_not", 6],
  ],
  pacific_islander: [
    ["christian", 52],
    ["catholic", 18],
    ["latter_day_saints", 14],
    ["spiritual", 8],
    ["prefer_not", 8],
  ],
  multiracial: [
    ["christian", 30],
    ["catholic", 12],
    ["spiritual", 14],
    ["agnostic", 14],
    ["atheist", 10],
    ["buddhist", 4],
    ["jewish", 3],
    ["muslim", 3],
    ["prefer_not", 10],
  ],
};

// Languages other than English, by background: [code, chance].
const LANGUAGES = {
  white: [
    ["es", 0.12],
    ["fr", 0.06],
    ["de", 0.04],
    ["it", 0.03],
    ["pl", 0.02],
    ["el", 0.01],
    ["he", 0.02],
    ["asl", 0.02],
  ],
  hispanic_latino: [
    ["es", 0.8],
    ["pt", 0.05],
    ["fr", 0.03],
  ],
  black: [
    ["fr", 0.05],
    ["ht", 0.06],
    ["sw", 0.04],
    ["yo", 0.04],
    ["am", 0.03],
    ["es", 0.05],
  ],
  asian: [
    ["zh", 0.35],
    ["vi", 0.25],
    ["ko", 0.25],
    ["ja", 0.2],
    ["tl", 0.2],
  ],
  south_asian: [
    ["hi", 0.5],
    ["ur", 0.2],
    ["bn", 0.12],
    ["pa", 0.12],
    ["gu", 0.12],
  ],
  middle_eastern: [
    ["ar", 0.7],
    ["fa", 0.15],
    ["fr", 0.05],
    ["he", 0.03],
  ],
  native_american: [["es", 0.1]],
  pacific_islander: [
    ["tl", 0.15],
    ["es", 0.05],
  ],
  multiracial: [
    ["es", 0.2],
    ["fr", 0.06],
    ["zh", 0.05],
    ["ko", 0.03],
  ],
};

// [job, a line about it, youngest, oldest]
const JOBS = [
  [
    "Nurse practitioner",
    "Nurse practitioner who loves a calm morning before a busy shift.",
    28,
    68,
  ],
  [
    "Registered nurse",
    "Night-shift nurse who treasures sunny afternoons and slow weekends.",
    23,
    66,
  ],
  [
    "Civil engineer",
    "Civil engineer; I build bridges for a living and try to in life too.",
    24,
    70,
  ],
  [
    "Middle school teacher",
    "Middle school teacher with endless patience and a dry sense of humor.",
    23,
    68,
  ],
  [
    "Elementary school teacher",
    "Elementary teacher who still gets a thrill from a first reader.",
    22,
    68,
  ],
  ["Accountant", "Accountant by day, home cook by night.", 23, 70],
  [
    "Firefighter",
    "Firefighter who knows the value of a good team and a quiet evening.",
    22,
    58,
  ],
  [
    "Graphic designer",
    "Graphic designer with a sketchbook in every bag.",
    22,
    65,
  ],
  [
    "Pharmacist",
    "Pharmacist who likes order, but leaves room for surprises.",
    26,
    68,
  ],
  [
    "Small business owner",
    "I run a small bakery and get up before the sun.",
    25,
    72,
  ],
  [
    "Software developer",
    "Software developer who'd rather be outside when the laptop closes.",
    22,
    62,
  ],
  [
    "Physical therapist",
    "Physical therapist helping people get back on their feet.",
    26,
    66,
  ],
  [
    "Social worker",
    "Social worker; I listen for a living and still love a good story.",
    23,
    68,
  ],
  [
    "Electrician",
    "Licensed electrician who fixes things for neighbors on weekends.",
    22,
    65,
  ],
  [
    "Plumber",
    "Master plumber who's happiest when everything just works.",
    24,
    66,
  ],
  [
    "Carpenter",
    "Carpenter who builds furniture the slow, old-fashioned way.",
    22,
    68,
  ],
  [
    "Veterinarian",
    "Veterinarian, so yes, I will want to meet your dog.",
    28,
    66,
  ],
  [
    "Pastor",
    "Pastor who loves people, potlucks and long conversations.",
    30,
    72,
  ],
  [
    "Youth pastor",
    "Youth pastor who's more at home with a guitar than a podium.",
    24,
    42,
  ],
  [
    "Marketing manager",
    "Marketing manager who plans everything except my free time.",
    26,
    62,
  ],
  [
    "Chef",
    "Restaurant chef learning to cook for two instead of two hundred.",
    24,
    62,
  ],
  [
    "Real estate agent",
    "Real estate agent who loves helping families find home.",
    24,
    70,
  ],
  [
    "Lawyer",
    "Family lawyer who believes in fair play and second chances.",
    27,
    70,
  ],
  [
    "Dental hygienist",
    "Dental hygienist with a big laugh and a bigger garden.",
    23,
    64,
  ],
  [
    "Dentist",
    "Dentist who promises to be gentle with more than teeth.",
    29,
    66,
  ],
  ["Truck driver", "Long-haul driver ready to stay closer to home.", 24, 66],
  [
    "Librarian",
    "Librarian with strong opinions about the best mystery series.",
    25,
    70,
  ],
  ["Mechanic", "Mechanic who restores old cars and older furniture.", 22, 68],
  [
    "Financial analyst",
    "Financial analyst who budgets for adventures.",
    23,
    62,
  ],
  [
    "Data analyst",
    "Data analyst who trusts numbers, and a good gut feeling too.",
    22,
    58,
  ],
  [
    "Police officer",
    "Community police officer who coaches youth basketball.",
    22,
    58,
  ],
  [
    "Hospital chaplain",
    "Hospital chaplain; I've learned what matters most.",
    32,
    72,
  ],
  ["Architect", "Architect who notices every doorway and window.", 26, 70],
  [
    "Paramedic",
    "Paramedic who stays calm in a crisis and laughs easily after.",
    22,
    55,
  ],
  [
    "Professor",
    "College professor who still loves the first day of class.",
    30,
    72,
  ],
  [
    "Farmer",
    "Third-generation farmer who knows the weather better than the news.",
    24,
    72,
  ],
  ["HR manager", "HR manager who's good at bringing people together.", 27, 64],
  [
    "Operations manager",
    "Operations manager who keeps the trains running and the weekends free.",
    27,
    64,
  ],
  [
    "Warehouse supervisor",
    "Warehouse supervisor who leads with a steady hand and a good playlist.",
    24,
    62,
  ],
  ["Park ranger", "Park ranger whose office has mountains for walls.", 24, 60],
  [
    "Journalist",
    "Local journalist who still believes in a good story told fairly.",
    24,
    66,
  ],
  [
    "Photographer",
    "Wedding photographer who's rarely on the other side of the camera.",
    23,
    66,
  ],
  [
    "Musician and music teacher",
    "Music teacher who plays piano at church and anywhere else they'll let me.",
    23,
    70,
  ],
  [
    "Cosmetologist",
    "Hair stylist who has heard every story and kept every secret.",
    22,
    64,
  ],
  [
    "Insurance agent",
    "Insurance agent who actually likes helping people plan ahead.",
    24,
    68,
  ],
  [
    "Nonprofit director",
    "Nonprofit director putting my heart into the neighborhood.",
    30,
    70,
  ],
  [
    "Church administrator",
    "Church administrator who knows where everything is and who's bringing dessert.",
    26,
    68,
  ],
  [
    "Home health aide",
    "Home health aide with a gentle touch and a lot of patience.",
    22,
    64,
  ],
  [
    "Pilot",
    "Commercial pilot who's learned the best view is the one coming home.",
    28,
    62,
  ],
  [
    "Graduate student",
    "Graduate student writing a thesis and learning to relax on weekends.",
    22,
    31,
  ],
  [
    "Barista and part-time student",
    "Barista and part-time student with a plan, a playlist and a lot of coffee.",
    21,
    27,
  ],
  [
    "College admissions counselor",
    "Admissions counselor who loves helping young people find their way.",
    24,
    50,
  ],
  [
    "Retired teacher",
    "Retired teacher with time for travel, volunteering and good company.",
    60,
    75,
  ],
  [
    "Retired nurse",
    "Retired nurse who finally has time for gardening and grandchildren.",
    60,
    75,
  ],
  [
    "Retired military",
    "Retired Army veteran who finally has time for fishing and family.",
    50,
    75,
  ],
];

const CLOSERS = [
  "Looking for someone kind, steady and ready to build something lasting.",
  "Hoping to meet a partner for slow Sundays and big family dinners.",
  "Ready for a relationship built on faith, honesty and laughter.",
  "Looking for my best friend and partner in everything.",
  "I want a home full of warmth, good food and people we love.",
  "Hoping to find someone who values commitment as much as I do.",
  "Looking for someone to grow with, one honest conversation at a time.",
  "Ready to stop swiping and start something real.",
  "Second chapters can be the best ones, and I'm ready for mine.",
  "Hoping to share the good days, and to be there for the hard ones.",
];

const TRAITS = [
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
];

const PROMPT_ANSWERS = {
  perfect_sunday: [
    "Church, brunch with friends, and a long walk somewhere green.",
    "Farmers market, a nap, and cooking something new for dinner.",
    "Coffee on the porch and nowhere to be until noon.",
    "Family over for a big lunch, then a game of dominoes.",
  ],
  values_most: [
    "Honesty, even when it's hard to hear.",
    "Family first, always.",
    "Keeping promises, big and small.",
    "Showing up, even when it's inconvenient.",
  ],
  friends_describe: [
    "The one who shows up with soup when you're sick.",
    "Reliable, a little goofy, always early.",
    "The planner of every trip and the keeper of every photo.",
    "The calm one in the group chat.",
  ],
  faith_means: [
    "It's the anchor for how I treat people.",
    "It's quiet and personal, but it guides my choices.",
    "Gratitude every morning and grace every evening.",
    "A community that shows up for each other.",
  ],
  together_we_could: [
    "Grow a vegetable garden and actually eat what we grow.",
    "Visit every national park, one road trip at a time.",
    "Host the best Thanksgiving our families have seen.",
    "Learn a language together and test it on a trip.",
  ],
  dealbreaker: [
    "Being rude to waiters.",
    "Not wanting to grow or learn.",
    "Dishonesty about the small things.",
    "Never apologizing.",
  ],
  love_language: [
    "Quality time: put the phone down and talk to me.",
    "Acts of service; a made bed says a lot.",
    "Words of affirmation, and I give them back.",
    "Small gifts that prove you were listening.",
  ],
  proudest_of: [
    "Paying off my student loans.",
    "Raising a kind, thoughtful kid.",
    "Running my first marathon at 40.",
    "Starting over and building a life I love.",
  ],
  green_flag: [
    "You call your mom just to say hi.",
    "You're kind to people who can't do anything for you.",
    "You remember the little things I mention.",
    "You can laugh at yourself.",
  ],
  learning_now: [
    "Spanish, slowly but surely.",
    "How to make sourdough without ruining it.",
    "Woodworking, with all ten fingers so far.",
    "The guitar, one chord at a time.",
  ],
};

const OPTIONS = {
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
  smoking: ["never", "never", "never", "never", "socially", "trying_to_quit"],
  drinking: ["never", "socially", "socially", "socially", "regularly", "sober"],
  workout: ["never", "sometimes", "sometimes", "often", "daily"],
  languages: ["es", "zh", "tl", "vi", "ar", "fr", "ko", "ru", "de", "hi"],
  pets: ["dog", "cat", "bird", "fish", "reptile", "small_pets"],
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
};

// One age group per slot, rotated by state so every state has four different
// ages and every group shows up for every gender.
const AGE_GROUPS = [
  (r) => 21 + Math.floor(r() * 9), // 21 to 29
  (r) => 30 + Math.floor(r() * 10), // 30 to 39
  (r) => 40 + Math.floor(r() * 10), // 40 to 49
  (r) => 50 + Math.floor(Math.pow(r(), 1.4) * 23), // 50 to 72, mostly the 50s
];

/** Slot 0 and 2 live in a state's first city, 1 and 3 in the second. */
const SLOT_GENDER = ["woman", "man", "man", "woman"];
const SLOT_CITY = [0, 1, 0, 1];

/**
 * `count` members from the 200 (at most 200), in an order where every prefix
 * is spread out: 50 is one per state, 100 two per state. Women, men and
 * non-binary members of every age group, backgrounds that follow the place,
 * and a mix of Premium profiles: about 60% full, 20% partial, 20% none. About
 * two in three have Premium membership (test mode), so Chat's waiting states
 * show too.
 */
export function generateMembers(count = 200) {
  const max = STATES.length * 4;
  if (count > max) throw new Error(`At most ${max} generated members.`);
  const r = rng(SEED);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const pickSome = (list, min, most) => {
    const n = min + Math.floor(r() * (most - min + 1));
    const pool = [...list];
    const out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    }
    return out;
  };
  const weighted = (entries) => {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let x = r() * total;
    for (const [value, w] of entries) {
      x -= w;
      if (x < 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  const used = new Set();
  /** An unused first name that fits the background, or any unused one. */
  const takeName = (gender, background) => {
    const source = gender === "woman" ? WOMEN : MEN;
    const from =
      background === "multiracial"
        ? pick(["white", "hispanic_latino", "black", "asian"])
        : background;
    for (const group of [from, ...Object.keys(source)]) {
      const free = source[group].filter((n) => !used.has(n));
      if (free.length) {
        const name = free[Math.floor(r() * free.length)];
        used.add(name);
        return name;
      }
    }
    throw new Error("Out of names.");
  };
  let nonBinaryUsed = 0;

  const members = [];
  for (let i = 0; i < count; i++) {
    const slot = Math.floor(i / STATES.length);
    const stateIndex = i % STATES.length;
    const state = STATES[stateIndex];
    const [city, zip] = PLACES[state][SLOT_CITY[slot]];
    // Every sixth state has a non-binary member in the last slot.
    const nonBinary = slot === 3 && stateIndex % 6 === 2;
    const gender = nonBinary ? "non_binary" : SLOT_GENDER[slot];

    const boost = ETHNICITY_BY_STATE[state] ?? {};
    const background = weighted(
      ETHNICITY_BASE.map(([group, w]) => [group, w * (boost[group] ?? 1)]),
    );
    const name = nonBinary
      ? NON_BINARY[nonBinaryUsed++]
      : takeName(gender, background);
    const age = AGE_GROUPS[(slot + stateIndex) % 4](r);
    const jobs = JOBS.filter(([, , from, to]) => age >= from && age <= to);
    const [profession, intro] = pick(jobs);

    const roll = r();
    const premium = roll < 0.6 ? "full" : roll < 0.8 ? "partial" : "none";
    const member = {
      name,
      gender,
      age,
      city,
      state,
      zip,
      background,
      about: `${intro} ${pick(CLOSERS)}`,
      traits: pickSome(TRAITS, 2, 4),
      premium,
      premiumMember: r() < 0.67,
    };

    if (premium !== "none") {
      const full = premium === "full";
      member.photos = full ? 2 + Math.floor(r() * 4) : Math.floor(r() * 2);
      member.video = full && r() < 0.4;

      // Life stage follows age.
      const marital = weighted(
        age < 30
          ? [
              ["never_married", 90],
              ["divorced", 6],
              ["separated", 4],
            ]
          : age < 45
            ? [
                ["never_married", 55],
                ["divorced", 30],
                ["separated", 11],
                ["widowed", 4],
              ]
            : age < 60
              ? [
                  ["never_married", 25],
                  ["divorced", 50],
                  ["separated", 8],
                  ["widowed", 17],
                ]
              : [
                  ["never_married", 12],
                  ["divorced", 46],
                  ["separated", 4],
                  ["widowed", 38],
                ],
      );
      const haveChildren =
        r() <
        (marital === "never_married"
          ? age < 35
            ? 0.05
            : 0.15
          : age < 35
            ? 0.4
            : 0.7);
      const children = !haveChildren
        ? "none"
        : age >= 52 || r() < 0.4
          ? "have_live_elsewhere"
          : "have_live_with_me";
      const family_plan = weighted(
        age < 35
          ? [
              ["want_children", 55],
              ["open_to_children", 28],
              ["not_sure", 12],
              ["dont_want_children", 5],
            ]
          : age < 45
            ? [
                ["want_children", 30],
                ["open_to_children", 35],
                ["not_sure", 15],
                ["dont_want_children", 20],
              ]
            : [
                ["want_children", 4],
                ["open_to_children", 24],
                ["not_sure", 12],
                ["dont_want_children", 60],
              ],
      );
      const education = weighted(
        [
          ["high_school", 8],
          ["trade_school", 9],
          ["some_college", 14],
          ["associate", 10],
          ["bachelor", 34],
          ["master", 18],
          ["doctorate", 5],
        ].filter(
          ([level]) =>
            !(age < 26 && (level === "master" || level === "doctorate")) &&
            !(age < 30 && level === "doctorate"),
        ),
      );

      let religion = weighted(RELIGION[background]);
      if (state === "UT" && r() < 0.55) religion = "latter_day_saints";
      const strict = religion === "muslim" || religion === "latter_day_saints";

      const details = {
        height_cm:
          gender === "woman"
            ? 150 + Math.floor(r() * 34)
            : gender === "man"
              ? 163 + Math.floor(r() * 34)
              : 155 + Math.floor(r() * 36),
        profession,
        education,
        religion,
        family_plan,
        marital_status: marital,
        children,
        smoking: strict ? "never" : pick(OPTIONS.smoking),
        drinking: strict ? pick(["never", "sober"]) : pick(OPTIONS.drinking),
      };
      if (full) {
        const languages = ["en"];
        for (const [code, chance] of LANGUAGES[background]) {
          if (r() < chance && languages.length < 4) languages.push(code);
        }
        Object.assign(details, {
          zodiac: pick(OPTIONS.zodiac),
          ethnicity: r() < 0.05 ? "prefer_not" : background,
          workout: pick(OPTIONS.workout),
          languages,
          pets: r() < 0.25 ? ["no_pets"] : pickSome(OPTIONS.pets, 1, 2),
          hobbies: pickSome(OPTIONS.hobbies, 2, 4),
          sports: pickSome(OPTIONS.sports, 1, 3),
          food_and_drink: pickSome(OPTIONS.food_and_drink, 2, 4),
          entertainment: pickSome(OPTIONS.entertainment, 2, 4),
          travel: pickSome(OPTIONS.travel, 1, 3),
          music: pickSome(OPTIONS.music, 2, 4),
          books: pickSome(OPTIONS.books, 1, 3),
        });
      }
      // Keep it believable: no wine or beer for someone who doesn't drink.
      if (
        details.food_and_drink &&
        (details.drinking === "never" || details.drinking === "sober")
      ) {
        details.food_and_drink = details.food_and_drink.filter(
          (f) => f !== "wine" && f !== "craft_beer",
        );
      }
      member.details = details;
      member.prompts = pickSome(
        Object.keys(PROMPT_ANSWERS),
        full ? 3 : 1,
        full ? 3 : 1,
      ).map((code) => [code, pick(PROMPT_ANSWERS[code])]);
    }
    members.push(member);
  }
  return members;
}
