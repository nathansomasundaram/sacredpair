/**
 * Profile Overview rules: what members can edit, what only the server can
 * set, and when a profile counts as complete.
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

/** Updates the member's own profile the way the app does, as that member. */
async function editAs(uid: string, set: Record<string, unknown>) {
  const keys = Object.keys(set);
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    await db.query(
      `update public.profiles set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`,
      [uid, ...keys.map((k) => set[k])],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

const read = (id: string) =>
  db
    .query(
      "select display_name, city, state_code, traits, primary_photo_path, is_complete, onboarded_at is not null as onboarded from public.profiles where id = $1",
      [id],
    )
    .then((r) => r.rows[0]);

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("editing the overview", () => {
  it("saves name, place, about me and traits", async () => {
    const id = await newMember();
    await editAs(id, {
      display_name: "Grace",
      city: "Raleigh",
      state_code: "NC",
      about_me: "Teacher, runner, terrible cook.",
      traits: ["kind", "curious", "faithful"],
    });
    expect(await read(id)).toMatchObject({
      display_name: "Grace",
      city: "Raleigh",
      state_code: "NC",
      traits: ["kind", "curious", "faithful"],
    });
  });

  it("accepts only known traits, at most five", async () => {
    const id = await newMember();
    await expect(
      editAs(id, { traits: ["kind", "mysterious"] }),
    ).rejects.toThrow(/profiles_traits_known/);
    await expect(
      editAs(id, {
        traits: ["kind", "honest", "loyal", "patient", "funny", "calm"],
      }),
    ).rejects.toThrow(/profiles_traits_max_five/);
  });

  it("accepts only real US states", async () => {
    const id = await newMember();
    await expect(editAs(id, { state_code: "ZZ" })).rejects.toThrow(
      /profiles_us_state/,
    );
    await editAs(id, { state_code: "DC" });
    expect((await read(id)).state_code).toBe("DC");
  });

  it("keeps about me to 1000 characters", async () => {
    const id = await newMember();
    await expect(editAs(id, { about_me: "x".repeat(1001) })).rejects.toThrow(
      /profiles_about_me_check/,
    );
  });
});

describe("the picture", () => {
  it("can't be pointed at another file by the member", async () => {
    const id = await newMember();
    await editAs(id, { primary_photo_path: "someone-else/photo.webp" });
    expect((await read(id)).primary_photo_path).toBeNull();
  });

  it("is set by the server", async () => {
    const id = await newMember();
    await db.query(
      "update public.profiles set primary_photo_path = $2 where id = $1",
      [id, `${id}/a.webp`],
    );
    expect((await read(id)).primary_photo_path).toBe(`${id}/a.webp`);
  });
});

describe("a complete profile", () => {
  it("needs a name, city, state and picture", async () => {
    const id = await newMember();
    await editAs(id, { display_name: "Sam", city: "Austin", state_code: "TX" });
    expect(await read(id)).toMatchObject({
      is_complete: false,
      onboarded: false,
    });

    await db.query(
      "update public.profiles set primary_photo_path = $2 where id = $1",
      [id, `${id}/b.webp`],
    );
    expect(await read(id)).toMatchObject({
      is_complete: true,
      onboarded: true,
    });
  });

  it("is recognised whichever comes last, the picture or the details", async () => {
    const id = await newMember();
    await db.query(
      "update public.profiles set primary_photo_path = $2 where id = $1",
      [id, `${id}/c.webp`],
    );
    await editAs(id, { display_name: "Ana", city: "Boise", state_code: "ID" });
    expect(await read(id)).toMatchObject({
      is_complete: true,
      onboarded: true,
    });
  });

  it("isn't complete with a blank name", async () => {
    const id = await newMember();
    await db.query(
      "update public.profiles set primary_photo_path = $2 where id = $1",
      [id, `${id}/d.webp`],
    );
    await editAs(id, { display_name: "   ", city: "Boise", state_code: "ID" });
    expect((await read(id)).is_complete).toBe(false);
  });
});
