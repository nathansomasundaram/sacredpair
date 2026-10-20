/**
 * Profile - Premium rules: known codes only, prompt rules, the photo limit,
 * the server-only video, and who can read what.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];

async function newMember() {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    `${id}@test.local`,
  ]);
  created.push(id);
  return id;
}

async function asMember<T = Record<string, unknown>>(
  uid: string,
  sql: string,
  values: unknown[] = [],
  commit = false,
) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    const r = await db.query(sql, values);
    await db.query(commit ? "commit" : "rollback");
    return r.rows as T[];
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

const update = (uid: string, set: string, values: unknown[] = []) =>
  asMember(
    uid,
    `update public.profile_premium set ${set} where profile_id = $1`,
    [uid, ...values],
    true,
  );

const premium = (id: string) =>
  db
    .query("select * from public.profile_premium where profile_id = $1", [id])
    .then((r) => r.rows[0]);

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("every member", () => {
  it("gets an empty Premium profile when they sign up", async () => {
    const id = await newMember();
    expect(await premium(id)).toMatchObject({
      profile_id: id,
      height_cm: null,
      prompts: [],
    });
  });
});

describe("details", () => {
  it("save known choices", async () => {
    const id = await newMember();
    await update(
      id,
      "height_cm = 170, religion = 'christian', smoking = 'never', languages = array['en','es'], hobbies = array['hiking','baking'], profession = 'Nurse'",
    );
    expect(await premium(id)).toMatchObject({
      height_cm: 170,
      religion: "christian",
      smoking: "never",
      languages: ["en", "es"],
      hobbies: ["hiking", "baking"],
      profession: "Nurse",
    });
  });

  it("refuse unknown codes", async () => {
    const id = await newMember();
    await expect(update(id, "religion = 'pastafarian'")).rejects.toThrow(
      /profile_premium_religion_known/,
    );
    await expect(update(id, "hobbies = array['skydiving']")).rejects.toThrow(
      /profile_premium_hobbies_known/,
    );
    await expect(update(id, "zodiac = 'ophiuchus'")).rejects.toThrow(
      /profile_premium_zodiac_known/,
    );
  });

  it("limit how many interests can be picked", async () => {
    const id = await newMember();
    await expect(
      update(
        id,
        "music = array['pop','rock','jazz','country','gospel','latin','indie']",
      ),
    ).rejects.toThrow(/profile_premium_music_known/);
  });

  it("keep height between 120 and 230 cm", async () => {
    const id = await newMember();
    await expect(update(id, "height_cm = 300")).rejects.toThrow(
      /height_cm_check/,
    );
  });

  it("let members say they'd rather not share faith or background", async () => {
    const id = await newMember();
    await update(id, "religion = 'prefer_not', ethnicity = 'prefer_not'");
    expect(await premium(id)).toMatchObject({
      religion: "prefer_not",
      ethnicity: "prefer_not",
    });
  });
});

describe("prompts", () => {
  const p = (prompt: string, answer: string) => ({ prompt, answer });

  it("accept up to three answered prompts", async () => {
    const id = await newMember();
    const prompts = [
      p("perfect_sunday", "Church, then pancakes."),
      p("green_flag", "Kind to waiters."),
    ];
    await update(id, "prompts = $2", [JSON.stringify(prompts)]);
    expect((await premium(id)).prompts).toEqual(prompts);
  });

  it("refuse a fourth prompt, a repeated prompt, an unknown prompt or an empty answer", async () => {
    const id = await newMember();
    const bad = [
      [
        p("perfect_sunday", "a"),
        p("values_most", "b"),
        p("green_flag", "c"),
        p("dealbreaker", "d"),
      ],
      [p("perfect_sunday", "a"), p("perfect_sunday", "b")],
      [p("secret_prompt", "a")],
      [p("perfect_sunday", "   ")],
      [p("perfect_sunday", "x".repeat(201))],
    ];
    for (const prompts of bad) {
      await expect(
        update(id, "prompts = $2", [JSON.stringify(prompts)]),
      ).rejects.toThrow(/profile_premium_prompts_valid/);
    }
  });
});

describe("media", () => {
  it("the video can only be set by the server", async () => {
    const id = await newMember();
    await update(id, "video_path = $2", [`${randomUUID()}/someone-elses.mp4`]);
    expect((await premium(id)).video_path).toBeNull();
    await db.query(
      "update public.profile_premium set video_path = $2 where profile_id = $1",
      [id, `${id}/v.mp4`],
    );
    expect((await premium(id)).video_path).toBe(`${id}/v.mp4`);
  });

  it("allows six extra photos at most", async () => {
    const id = await newMember();
    for (let i = 1; i <= 6; i++) {
      await db.query(
        "insert into public.profile_photos (profile_id, storage_path, position) values ($1, $2, $3)",
        [id, `${id}/p${i}.webp`, i],
      );
    }
    await expect(
      db.query(
        "insert into public.profile_photos (profile_id, storage_path, position) values ($1, $2, 7)",
        [id, `${id}/p7.webp`],
      ),
    ).rejects.toThrow(/too_many_photos/);
  });

  it("members can't add photo records themselves", async () => {
    const id = await newMember();
    await expect(
      asMember(
        id,
        "insert into public.profile_photos (profile_id, storage_path) values ($1, $2)",
        [id, `${id}/sneaky.webp`],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("who can see Premium details", () => {
  it("the owner always can; a free stranger can't", async () => {
    const owner = await newMember();
    const stranger = await newMember();
    await update(owner, "religion = 'jewish'");
    expect(
      await asMember(
        owner,
        "select religion from public.profile_premium where profile_id = $1",
        [owner],
      ),
    ).toEqual([{ religion: "jewish" }]);
    expect(
      await asMember(
        stranger,
        "select 1 from public.profile_premium where profile_id = $1",
        [owner],
      ),
    ).toHaveLength(0);
  });
});
