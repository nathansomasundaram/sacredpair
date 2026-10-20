/**
 * Settings: distance and Premium filters in Discover, private locations,
 * notification records and push subscriptions.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];
let nextAge = 60;

function birthdateForAge(age: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}

// Raleigh, Durham (about 35 km away) and Los Angeles.
const RALEIGH = [35.78, -78.64] as const;
const DURHAM = [35.99, -78.9] as const;
const LA = [34.05, -118.24] as const;

async function member(o: {
  age: number;
  state?: string;
  at?: readonly [number, number];
  premium?: boolean;
  ageRange?: [number, number];
  radiusKm?: number;
  premiumAnswers?: Record<string, unknown>;
}) {
  const id = randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${id}@test.local`, { birthdate: birthdateForAge(o.age) }],
  );
  created.push(id);
  await db.query(
    `update public.profiles set display_name = 'M', city = 'Somewhere', state_code = $2,
       primary_photo_path = $3, id_verified_at = now() where id = $1`,
    [id, o.state ?? "NC", `${id}/p.webp`],
  );
  await db.query(
    "update public.preferences set age_min = $2, age_max = $3, radius_km = $4 where profile_id = $1",
    [id, o.ageRange?.[0] ?? 18, o.ageRange?.[1] ?? 99, o.radiusKm ?? 5000],
  );
  if (o.at) {
    await db.query(
      "update public.account_private set latitude = $2, longitude = $3 where user_id = $1",
      [id, o.at[0], o.at[1]],
    );
  }
  if (o.premium) {
    await db.query(
      "update public.entitlements set tier = 'premium', source = 'simulated' where user_id = $1",
      [id],
    );
  }
  if (o.premiumAnswers) {
    const keys = Object.keys(o.premiumAnswers);
    await db.query(
      `update public.profile_premium set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where profile_id = $1`,
      [id, ...keys.map((k) => o.premiumAnswers![k])],
    );
  }
  return id;
}

/** A viewer plus others at an age only this scenario uses. */
async function scenario(
  viewer: Parameters<typeof member>[0] extends infer T
    ? Partial<T>
    : never = {},
) {
  const age = nextAge++;
  const me = await member({ age: 40, ageRange: [age, age], ...viewer });
  return {
    me,
    other: (o: Partial<Parameters<typeof member>[0]> = {}) =>
      member({ age, ...o }),
  };
}

const candidates = (uid: string) =>
  db
    .query("select * from public.discovery_candidates($1, 50) as id", [uid])
    .then((r) => r.rows.map((x) => x.id));

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("distance", () => {
  it("keeps to the viewer's limit when both have a location", async () => {
    const s = await scenario({ at: RALEIGH, radiusKm: 80 });
    const near = await s.other({ at: DURHAM });
    const far = await s.other({ at: LA, state: "CA" });
    expect(await candidates(s.me)).toEqual([near]);
    expect(far).toBeTruthy();
  });

  it("respects the other person's limit too", async () => {
    const s = await scenario({ at: RALEIGH });
    await s.other({ at: LA, state: "CA", radiusKm: 80 });
    expect(await candidates(s.me)).toEqual([]);
  });

  it("uses the same state for people without a location", async () => {
    const s = await scenario({ at: RALEIGH, radiusKm: 80 });
    const sameState = await s.other({ state: "NC" });
    await s.other({ state: "VA" });
    expect(await candidates(s.me)).toEqual([sameState]);
  });

  it("puts the nearest first", async () => {
    const s = await scenario({ at: RALEIGH });
    const far = await s.other({ at: LA, state: "CA" });
    const near = await s.other({ at: DURHAM });
    expect(await candidates(s.me)).toEqual([near, far]);
  });

  it("measures distance correctly", async () => {
    const r = await db.query(
      "select round(public.distance_km($1, $2, $3, $4)) as km",
      [...RALEIGH, ...LA],
    );
    expect(Number(r.rows[0].km)).toBeGreaterThan(3500);
    expect(Number(r.rows[0].km)).toBeLessThan(3700);
  });
});

describe("Premium filters", () => {
  it("apply only while the viewer is Premium", async () => {
    const s = await scenario();
    await db.query(
      "update public.preferences set smoking = '{never}' where profile_id = $1",
      [s.me],
    );
    const smoker = await s.other({ premiumAnswers: { smoking: "regularly" } });
    const nonSmoker = await s.other({ premiumAnswers: { smoking: "never" } });
    expect((await candidates(s.me)).sort()).toEqual([smoker, nonSmoker].sort());
    await db.query(
      "update public.entitlements set tier = 'premium' where user_id = $1",
      [s.me],
    );
    expect(await candidates(s.me)).toEqual([nonSmoker]);
  });

  it("don't filter out people who haven't answered", async () => {
    const s = await scenario({ premium: true });
    await db.query(
      "update public.preferences set religion = '{christian}', family_plan = '{want_children}' where profile_id = $1",
      [s.me],
    );
    const unanswered = await s.other();
    const preferNot = await s.other({
      premiumAnswers: { religion: "prefer_not" },
    });
    const other = await s.other({ premiumAnswers: { religion: "buddhist" } });
    const match = await s.other({
      premiumAnswers: { religion: "christian", family_plan: "want_children" },
    });
    const result = await candidates(s.me);
    expect(result.sort()).toEqual([unanswered, preferNot, match].sort());
    expect(result).not.toContain(other);
  });

  it("match pets as “fine with”", async () => {
    const s = await scenario({ premium: true });
    await db.query(
      "update public.preferences set pets = '{dog,no_pets}' where profile_id = $1",
      [s.me],
    );
    const dogOwner = await s.other({
      premiumAnswers: { pets: ["dog", "allergic"] },
    });
    await s.other({ premiumAnswers: { pets: ["cat"] } });
    await s.other({ premiumAnswers: { pets: ["dog", "cat"] } });
    expect(await candidates(s.me)).toEqual([dogOwner]);
  });

  it("only accept known choices", async () => {
    const s = await scenario();
    await expect(
      db.query(
        "update public.preferences set religion = '{flat_earth}' where profile_id = $1",
        [s.me],
      ),
    ).rejects.toThrow(/preferences_religion_known/);
    await expect(
      db.query(
        "update public.preferences set religion = '{prefer_not}' where profile_id = $1",
        [s.me],
      ),
    ).rejects.toThrow(/preferences_religion_known/);
  });
});

async function as<T = Record<string, unknown>>(
  uid: string,
  sql: string,
  values: unknown[] = [],
) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    const r = await db.query(sql, values);
    await db.query("commit");
    return r.rows as T[];
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

describe("privacy", () => {
  it("keeps locations private, even from people introduced", async () => {
    const a = await member({ age: 40, at: RALEIGH });
    const b = await member({ age: 41, at: DURHAM });
    const batch = await db.query(
      "insert into public.discovery_batches (user_id, week_start) values ($1, public.discovery_week()) returning id",
      [a],
    );
    await db.query(
      "insert into public.discovery_batch_items (batch_id, profile_id, position) values ($1, $2, 1)",
      [batch.rows[0].id, b],
    );
    expect(
      await as(
        a,
        "select latitude from public.account_private where user_id = $1",
        [b],
      ),
    ).toEqual([]);
    expect(
      await as(
        a,
        "select latitude from public.account_private where user_id = $1",
        [a],
      ),
    ).toHaveLength(1);
  });

  it("lets members set their location only through the server", async () => {
    const a = await member({ age: 40 });
    await expect(
      as(
        a,
        "update public.account_private set latitude = 1, longitude = 1 where user_id = $1",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("keeps notification logs and phone codes server-only", async () => {
    const a = await member({ age: 40 });
    expect(await as(a, "select * from public.notification_log")).toEqual([]);
    expect(await as(a, "select * from public.phone_codes")).toEqual([]);
  });

  it("lets members manage only their own push devices", async () => {
    const a = await member({ age: 40 });
    const b = await member({ age: 40 });
    await as(
      a,
      "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')",
      [a, `https://push.example/${a}`],
    );
    await expect(
      as(
        b,
        "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')",
        [a, `https://push.example/${b}`],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await as(
        b,
        "select * from public.push_subscriptions where user_id = $1",
        [a],
      ),
    ).toEqual([]);
    await expect(
      as(
        a,
        "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'http://insecure', 'k', 'a')",
        [a],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("notification limits", () => {
  const claim = (user: string, minutes: number) =>
    db
      .query(
        "select public.claim_notification($1, 'email', 'messages', 'conv-1', $2) as id",
        [user, minutes],
      )
      .then((r) => r.rows[0].id as string | null);

  it("allow one note per quiet period, even when asked at the same moment", async () => {
    const a = await member({ age: 40 });
    const results = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        try {
          return (
            await c.query(
              "select public.claim_notification($1, 'email', 'messages', 'conv-1', 60) as id",
              [a],
            )
          ).rows[0].id;
        } finally {
          await c.end();
        }
      }),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("try again after a failed send", async () => {
    const a = await member({ age: 40 });
    const id = await claim(a, 60);
    await db.query(
      "update public.notification_log set status = 'failed' where id = $1",
      [id],
    );
    expect(await claim(a, 60)).not.toBeNull();
  });

  it("don't limit notes with no quiet period", async () => {
    const a = await member({ age: 40 });
    expect(await claim(a, 0)).not.toBeNull();
    expect(await claim(a, 0)).not.toBeNull();
  });

  it("can't be claimed by members", async () => {
    const a = await member({ age: 40 });
    await expect(
      as(
        a,
        "select public.claim_notification($1, 'email', 'messages', 'x', 60)",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
