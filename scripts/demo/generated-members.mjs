/**
 * Extra fictional demo members, spread across the United States, so
 * Discover, distance and filters can be tried with a realistic crowd.
 *
 * Everything is generated from a fixed seed, so every run produces exactly
 * the same people with the same details: running the seed again refreshes
 * them instead of adding new ones. Change SEED to get a different crowd.
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

// A downtown ZIP code in each place. Every region and most states.
export const PLACES = [
  ["New York", "NY", "10001"],
  ["Brooklyn", "NY", "11201"],
  ["Buffalo", "NY", "14202"],
  ["Boston", "MA", "02108"],
  ["Worcester", "MA", "01608"],
  ["Providence", "RI", "02903"],
  ["Hartford", "CT", "06103"],
  ["Burlington", "VT", "05401"],
  ["Portland", "ME", "04101"],
  ["Manchester", "NH", "03101"],
  ["Philadelphia", "PA", "19103"],
  ["Pittsburgh", "PA", "15222"],
  ["Newark", "NJ", "07102"],
  ["Wilmington", "DE", "19801"],
  ["Baltimore", "MD", "21201"],
  ["Washington", "DC", "20001"],
  ["Arlington", "VA", "22201"],
  ["Virginia Beach", "VA", "23451"],
  ["Charleston", "WV", "25301"],
  ["Charleston", "SC", "29401"],
  ["Savannah", "GA", "31401"],
  ["Jacksonville", "FL", "32202"],
  ["Orlando", "FL", "32801"],
  ["Tampa", "FL", "33602"],
  ["Miami", "FL", "33130"],
  ["Birmingham", "AL", "35203"],
  ["Mobile", "AL", "36602"],
  ["Jackson", "MS", "39201"],
  ["Memphis", "TN", "38103"],
  ["Knoxville", "TN", "37902"],
  ["Louisville", "KY", "40202"],
  ["Lexington", "KY", "40507"],
  ["New Orleans", "LA", "70112"],
  ["Baton Rouge", "LA", "70801"],
  ["Little Rock", "AR", "72201"],
  ["Houston", "TX", "77002"],
  ["Dallas", "TX", "75201"],
  ["Austin", "TX", "78701"],
  ["San Antonio", "TX", "78205"],
  ["El Paso", "TX", "79901"],
  ["Oklahoma City", "OK", "73102"],
  ["Tulsa", "OK", "74103"],
  ["Columbus", "OH", "43215"],
  ["Cleveland", "OH", "44113"],
  ["Cincinnati", "OH", "45202"],
  ["Detroit", "MI", "48226"],
  ["Grand Rapids", "MI", "49503"],
  ["Indianapolis", "IN", "46204"],
  ["Chicago", "IL", "60601"],
  ["Springfield", "IL", "62701"],
  ["Milwaukee", "WI", "53202"],
  ["Madison", "WI", "53703"],
  ["Minneapolis", "MN", "55401"],
  ["Des Moines", "IA", "50309"],
  ["St. Louis", "MO", "63101"],
  ["Kansas City", "MO", "64106"],
  ["Wichita", "KS", "67202"],
  ["Omaha", "NE", "68102"],
  ["Sioux Falls", "SD", "57104"],
  ["Fargo", "ND", "58102"],
  ["Denver", "CO", "80202"],
  ["Colorado Springs", "CO", "80903"],
  ["Salt Lake City", "UT", "84101"],
  ["Boise", "ID", "83702"],
  ["Billings", "MT", "59101"],
  ["Cheyenne", "WY", "82001"],
  ["Albuquerque", "NM", "87102"],
  ["Phoenix", "AZ", "85004"],
  ["Tucson", "AZ", "85701"],
  ["Las Vegas", "NV", "89101"],
  ["Reno", "NV", "89501"],
  ["Los Angeles", "CA", "90012"],
  ["San Diego", "CA", "92101"],
  ["San Francisco", "CA", "94103"],
  ["Sacramento", "CA", "95814"],
  ["Fresno", "CA", "93721"],
  ["Portland", "OR", "97205"],
  ["Seattle", "WA", "98101"],
  ["Spokane", "WA", "99201"],
  ["Anchorage", "AK", "99501"],
  ["Honolulu", "HI", "96813"],
];

// Unique first names, none shared with the hand-written demo members.
const WOMEN = [
  "Abigail",
  "Alicia",
  "Amara",
  "Andrea",
  "Beatriz",
  "Bianca",
  "Camille",
  "Carmen",
  "Chloe",
  "Claire",
  "Danielle",
  "Elena",
  "Erin",
  "Esther",
  "Fatima",
  "Gabriela",
  "Holly",
  "Imani",
  "Iris",
  "Jasmine",
  "Joy",
  "Keisha",
  "Laura",
  "Lydia",
  "Maya",
  "Megan",
  "Mei",
  "Monica",
  "Nadia",
  "Olivia",
  "Priya",
  "Rachel",
  "Rosa",
  "Sarah",
  "Sofia",
  "Tamara",
  "Valerie",
  "Vanessa",
  "Whitney",
  "Yasmin",
];
const MEN = [
  "Aaron",
  "Adrian",
  "Ahmed",
  "Andre",
  "Anthony",
  "Ben",
  "Brandon",
  "Carlos",
  "Chris",
  "David",
  "Derek",
  "Diego",
  "Ethan",
  "Felix",
  "Gabriel",
  "Grant",
  "Henry",
  "Hiro",
  "Ivan",
  "Jamal",
  "James",
  "Javier",
  "Kevin",
  "Luis",
  "Malik",
  "Mateo",
  "Nathan",
  "Nick",
  "Omar",
  "Owen",
  "Patrick",
  "Rafael",
  "Raj",
  "Ryan",
  "Sean",
  "Thomas",
  "Tyler",
  "Victor",
  "Wesley",
  "Zach",
];

const JOBS = [
  [
    "Nurse practitioner",
    "Nurse practitioner who loves a calm morning before a busy shift.",
  ],
  [
    "Civil engineer",
    "Civil engineer; I build bridges for a living and try to in life too.",
  ],
  [
    "Middle school teacher",
    "Middle school teacher with endless patience and a dry sense of humor.",
  ],
  ["Accountant", "Accountant by day, home cook by night."],
  [
    "Firefighter",
    "Firefighter who knows the value of a good team and a quiet evening.",
  ],
  ["Graphic designer", "Graphic designer with a sketchbook in every bag."],
  ["Pharmacist", "Pharmacist who likes order, but leaves room for surprises."],
  ["Small business owner", "I run a small bakery and get up before the sun."],
  [
    "Software developer",
    "Software developer who'd rather be outside when the laptop closes.",
  ],
  [
    "Physical therapist",
    "Physical therapist helping people get back on their feet.",
  ],
  [
    "Social worker",
    "Social worker; I listen for a living and still love a good story.",
  ],
  [
    "Electrician",
    "Licensed electrician who fixes things for neighbors on weekends.",
  ],
  ["Veterinarian", "Veterinarian, so yes, I will want to meet your dog."],
  [
    "Pastor",
    "Associate pastor who loves people, potlucks and long conversations.",
  ],
  [
    "Marketing manager",
    "Marketing manager who plans everything except my free time.",
  ],
  ["Chef", "Restaurant chef learning to cook for two instead of two hundred."],
  [
    "Real estate agent",
    "Real estate agent who loves helping families find home.",
  ],
  ["Lawyer", "Family lawyer who believes in fair play and second chances."],
  [
    "Dental hygienist",
    "Dental hygienist with a big laugh and a bigger garden.",
  ],
  ["Truck driver", "Long-haul driver ready to stay closer to home."],
  [
    "Librarian",
    "Librarian with strong opinions about the best mystery series.",
  ],
  ["Mechanic", "Mechanic who restores old cars and older furniture."],
  ["Financial analyst", "Financial analyst who budgets for adventures."],
  ["Police officer", "Community police officer who coaches youth basketball."],
  ["Hospital chaplain", "Hospital chaplain; I've learned what matters most."],
  ["Architect", "Architect who notices every doorway and window."],
  [
    "Paramedic",
    "Paramedic who stays calm in a crisis and laughs easily after.",
  ],
  ["Professor", "College professor who still loves the first day of class."],
  [
    "Farmer",
    "Third-generation farmer who knows the weather better than the news.",
  ],
  ["HR manager", "HR manager who's good at bringing people together."],
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
  ],
  values_most: [
    "Honesty, even when it's hard to hear.",
    "Family first, always.",
    "Keeping promises, big and small.",
  ],
  friends_describe: [
    "The one who shows up with soup when you're sick.",
    "Reliable, a little goofy, always early.",
    "The planner of every trip and the keeper of every photo.",
  ],
  faith_means: [
    "It's the anchor for how I treat people.",
    "It's quiet and personal, but it guides my choices.",
    "Gratitude every morning and grace every evening.",
  ],
  together_we_could: [
    "Grow a vegetable garden and actually eat what we grow.",
    "Visit every national park, one road trip at a time.",
    "Host the best Thanksgiving our families have seen.",
  ],
  dealbreaker: [
    "Being rude to waiters.",
    "Not wanting to grow or learn.",
    "Dishonesty about the small things.",
  ],
  love_language: [
    "Quality time: put the phone down and talk to me.",
    "Acts of service; a made bed says a lot.",
    "Words of affirmation, and I give them back.",
  ],
  proudest_of: [
    "Paying off my student loans.",
    "Raising a kind, thoughtful kid.",
    "Running my first marathon at 40.",
  ],
  green_flag: [
    "You call your mom just to say hi.",
    "You're kind to people who can't do anything for you.",
    "You remember the little things I mention.",
  ],
  learning_now: [
    "Spanish, slowly but surely.",
    "How to make sourdough without ruining it.",
    "Woodworking, with all ten fingers so far.",
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
  religion: [
    "christian",
    "christian",
    "christian",
    "catholic",
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
    "prefer_not",
  ],
  marital_status: [
    "never_married",
    "never_married",
    "divorced",
    "divorced",
    "separated",
    "widowed",
  ],
  children: ["none", "none", "have_live_with_me", "have_live_elsewhere"],
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
    "bachelor",
    "master",
    "doctorate",
  ],
  smoking: ["never", "never", "never", "socially", "trying_to_quit"],
  drinking: ["never", "socially", "socially", "regularly", "sober"],
  workout: ["never", "sometimes", "often", "daily"],
  languages: [
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
    "asl",
  ],
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

/**
 * `count` members (at most one per place and name: 80), alternating women
 * and men, with ages 25 to 62 and a mix of Premium profiles:
 * about half full, a quarter partial, a quarter none. About two in three
 * have Premium membership (test mode), so Chat's waiting states show too.
 */
export function generateMembers(count = 80) {
  const max = Math.min(PLACES.length, WOMEN.length + MEN.length);
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

  const members = [];
  for (let i = 0; i < count; i++) {
    const woman = i % 2 === 0;
    const name = (woman ? WOMEN : MEN)[Math.floor(i / 2)];
    const [city, state, zip] = PLACES[i];
    const age = 25 + Math.floor(r() * 38);
    const [profession, intro] = pick(JOBS);
    const roll = r();
    const premium = roll < 0.5 ? "full" : roll < 0.75 ? "partial" : "none";
    const member = {
      name,
      gender: woman ? "woman" : "man",
      age,
      city,
      state,
      zip,
      about: `${intro} ${pick(CLOSERS)}`,
      traits: pickSome(TRAITS, 2, 4),
      premium,
      premiumMember: r() < 0.67,
    };

    if (premium !== "none") {
      const full = premium === "full";
      member.photos = full ? 2 + Math.floor(r() * 4) : Math.floor(r() * 2);
      member.video = full && r() < 0.5;
      const details = {
        height_cm: woman
          ? 155 + Math.floor(r() * 25)
          : 168 + Math.floor(r() * 25),
        profession,
        education: pick(OPTIONS.education),
        religion: pick(OPTIONS.religion),
        family_plan: pick(OPTIONS.family_plan),
        marital_status: pick(OPTIONS.marital_status),
        children: pick(OPTIONS.children),
        smoking: pick(OPTIONS.smoking),
        drinking: pick(OPTIONS.drinking),
      };
      if (full) {
        Object.assign(details, {
          zodiac: pick(OPTIONS.zodiac),
          ethnicity: pick(OPTIONS.ethnicity),
          workout: pick(OPTIONS.workout),
          languages: ["en", ...pickSome(OPTIONS.languages, 0, 2)],
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
