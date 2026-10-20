/**
 * Weekly introductions: who is introduced, the four-a-week limit, and
 * that nothing changes when the wand is tapped again.
 *
 * Other test files share this database, so each scenario gives its members
 * an unusual age and sets the viewer's age range to match: only that
 * scenario's members can be introduced.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];
let nextAge = 70;

function birthdateForAge(age: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}

type MemberOpts = {
  age: number;
  city?: string;
  state?: string;
  gender?: string | null;
  lookingFor?: string[];
  verified?: boolean;
  complete?: boolean;
  banned?: boolean;
  ageRange?: [number, number];
};

async function member(o: MemberOpts) {
  const id = randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${id}@test.local`, { birthdate: birthdateForAge(o.age) }],
  );
  created.push(id);
  const complete = o.complete ?? true;
  await db.query(
    `update public.profiles set display_name = $2, city = $3, state_code = $4,
       primary_photo_path = $5, gender = $6, id_verified_at = $7, banned_at = $8
     where id = $1`,
    [
      id,
      complete ? "Member" : "",
      o.city ?? "Elsewhere",
      o.state ?? "TX",
      complete ? `${id}/p.webp` : null,
      o.gender ?? null,
      o.verified === false ? null : new Date(),
      o.banned ? new Date() : null,
    ],
  );
  await db.query(
    "update public.preferences set looking_for = $2, age_min = $3, age_max = $4 where profile_id = $1",
    [id, o.lookingFor ?? [], o.ageRange?.[0] ?? 18, o.ageRange?.[1] ?? 99],
  );
  return id;
}

/** A viewer plus helpers scoped to a fresh, unused age. */
async function scenario(viewer: Partial<MemberOpts> = {}) {
  const age = nextAge++;
  const me = await member({ age: 40, ageRange: [age, age], ...viewer });
  return {
    me,
    age,
    other: (o: Partial<MemberOpts> = {}) => member({ age, ...o }),
  };
}

const fill = (user: string, week: string) =>
  db
    .query("select public.fill_discovery_batch($1, $2::date) as n", [
      user,
      week,
    ])
    .then((r) => r.rows[0].n as number);

const introduced = (user: string, week: string) =>
  db
    .query(
      `select i.profile_id from public.discovery_batch_items i
       join public.discovery_batches b on b.id = i.batch_id
       where b.user_id = $1 and b.week_start = $2::date order by i.position`,
      [user, week],
    )
    .then((r) => r.rows.map((x) => x.profile_id as string));

const WEEK = "2030-01-07";
const NEXT_WEEK = "2030-01-14";

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("the week", () => {
  it("starts on Monday, US Eastern time", async () => {
    const r = await db.query(
      "select public.discovery_week('2026-10-25 23:30-04') as sun, public.discovery_week('2026-10-26 00:30-04') as mon",
    );
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    expect(iso(r.rows[0].sun)).toBe("2026-10-19");
    expect(iso(r.rows[0].mon)).toBe("2026-10-26");
  });
});

describe("the magic wand", () => {
  it("introduces four people, nearest first", async () => {
    const s = await scenario({ city: "Raleigh", state: "NC" });
    const sameCity = await s.other({ city: "raleigh ", state: "NC" });
    const sameState = await s.other({ city: "Durham", state: "NC" });
    await s.other();
    await s.other();
    await s.other();

    expect(await fill(s.me, WEEK)).toBe(4);
    const list = await introduced(s.me, WEEK);
    expect(list).toHaveLength(4);
    expect(list.slice(0, 2)).toEqual([sameCity, sameState]);
  });

  it("gives the same four however often it's tapped that week", async () => {
    const s = await scenario();
    for (let i = 0; i < 6; i++) await s.other();
    await fill(s.me, WEEK);
    const first = await introduced(s.me, WEEK);
    expect(await fill(s.me, WEEK)).toBe(4);
    expect(await introduced(s.me, WEEK)).toEqual(first);
  });

  it("brings new people next week, never the same ones again", async () => {
    const s = await scenario();
    for (let i = 0; i < 6; i++) await s.other();
    await fill(s.me, WEEK);
    const first = await introduced(s.me, WEEK);
    expect(await fill(s.me, NEXT_WEEK)).toBe(2);
    const second = await introduced(s.me, NEXT_WEEK);
    expect(second.some((id) => first.includes(id))).toBe(false);
  });

  it("tops up during the week when fewer than four were available", async () => {
    const s = await scenario();
    await s.other();
    expect(await fill(s.me, WEEK)).toBe(1);
    await s.other();
    await s.other();
    expect(await fill(s.me, WEEK)).toBe(3);
  });

  it("doesn't use up the week when nobody suits yet", async () => {
    const s = await scenario();
    expect(await fill(s.me, WEEK)).toBe(0);
    const r = await db.query(
      "select 1 from public.discovery_batches where user_id = $1 and week_start = $2",
      [s.me, WEEK],
    );
    expect(r.rowCount).toBe(0);
  });
});

describe("who is never introduced", () => {
  it("unverified, incomplete, banned and hidden members", async () => {
    const s = await scenario();
    await s.other({ verified: false });
    await s.other({ complete: false });
    await s.other({ banned: true });
    const hidden = await s.other();
    await db.query(
      "update public.profiles set is_visible = false where id = $1",
      [hidden],
    );
    expect(await fill(s.me, WEEK)).toBe(0);
  });

  it("anyone blocked, in either direction", async () => {
    const s = await scenario();
    const blockedByMe = await s.other();
    const blockedMe = await s.other();
    await db.query(
      "insert into public.blocks (blocker_id, blocked_id) values ($1, $2), ($3, $1)",
      [s.me, blockedByMe, blockedMe],
    );
    expect(await fill(s.me, WEEK)).toBe(0);
  });

  it("someone whose 'looking for' doesn't include the viewer", async () => {
    const s = await scenario({ gender: "woman", lookingFor: ["man"] });
    await s.other({ gender: "man", lookingFor: ["man"] });
    await s.other({ gender: "woman", lookingFor: ["man"] });
    const fits = await s.other({ gender: "man", lookingFor: ["woman"] });
    await fill(s.me, WEEK);
    expect(await introduced(s.me, WEEK)).toEqual([fits]);
  });

  it("someone whose age range doesn't include the viewer", async () => {
    const s = await scenario();
    await s.other({ ageRange: [18, 30] }); // the viewer is 40
    const fits = await s.other({ ageRange: [35, 45] });
    await fill(s.me, WEEK);
    expect(await introduced(s.me, WEEK)).toEqual([fits]);
  });
});

describe("members", () => {
  it("must be verified with a complete profile to use the wand", async () => {
    const incomplete = await member({ age: 40, complete: false });
    await expect(fill(incomplete, WEEK)).rejects.toThrow(/profile_incomplete/);
    const unverified = await member({ age: 40, verified: false });
    await expect(fill(unverified, WEEK)).rejects.toThrow(/not_verified/);
  });

  it("can only reveal their own introductions for the current week", async () => {
    const s = await scenario();
    const someone = await s.other();
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: s.me, role: "authenticated" }),
      ]);
      await expect(
        db.query("select public.fill_discovery_batch($1, '2040-01-02')", [
          s.me,
        ]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.query("rollback");
    }

    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: s.me, role: "authenticated" }),
    ]);
    const r = await db.query("select public.reveal_introductions() as n");
    expect(r.rows[0].n).toBe(1);
    // Now allowed to see the person introduced.
    const seen = await db.query(
      "select id from public.profiles where id = $1",
      [someone],
    );
    expect(seen.rows).toEqual([{ id: someone }]);
    await db.query("rollback");
  });
});
