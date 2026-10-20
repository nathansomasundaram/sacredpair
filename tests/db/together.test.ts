/**
 * Together: proposing and accepting a path, one path at a time, levels in
 * order with neither person more than one level ahead.
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

async function couple() {
  const a = await newMember();
  const b = await newMember();
  const r = await db.query(
    "insert into public.connections (user_a, user_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid)) returning id",
    [a, b],
  );
  return { a, b, cid: r.rows[0].id as string };
}

const propose = (uid: string, cid: string, path = "grow_a_tree") =>
  as<{ id: string }>(
    uid,
    "insert into public.journeys (connection_id, path, proposed_by) values ($1, $2, $3) returning id",
    [cid, path, uid],
  ).then((r) => r[0].id);

const accept = (uid: string, jid: string) =>
  as(uid, "select public.accept_journey($1)", [jid]);
const complete = (uid: string, jid: string, level: number, score = 80) =>
  as(uid, "select public.complete_level($1, $2, $3)", [jid, level, score]);

async function activeJourney() {
  const c = await couple();
  const jid = await propose(c.a, c.cid);
  await accept(c.b, jid);
  return { ...c, jid };
}

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("choosing a path", () => {
  it("is proposed by one and accepted by the other", async () => {
    const { a, b, cid } = await couple();
    const jid = await propose(a, cid, "build_a_house");
    await expect(accept(a, jid)).rejects.toThrow(/not yours to accept/);
    await accept(b, jid);
    const r = await db.query(
      "select path, accepted_at from public.journeys where id = $1",
      [jid],
    );
    expect(r.rows[0].path).toBe("build_a_house");
    expect(r.rows[0].accepted_at).not.toBeNull();
  });

  it("allows one path at a time", async () => {
    const { a, b, cid } = await couple();
    await propose(a, cid);
    await expect(propose(b, cid, "write_a_book")).rejects.toThrow(
      /journeys_one_open_idx/,
    );
  });

  it("can be declined, and then another suggested", async () => {
    const { a, b, cid } = await couple();
    const jid = await propose(a, cid);
    await as(b, "update public.journeys set ended_at = now() where id = $1", [
      jid,
    ]);
    await propose(b, cid, "write_a_book");
  });

  it("only between the two people connected", async () => {
    const { cid } = await couple();
    const stranger = await newMember();
    await expect(propose(stranger, cid)).rejects.toThrow(/row-level security/);
    expect(
      await as(
        stranger,
        "select * from public.journeys where connection_id = $1",
        [cid],
      ),
    ).toEqual([]);
  });

  it("only on the three paths", async () => {
    const { a, cid } = await couple();
    await expect(propose(a, cid, "climb_a_mountain")).rejects.toThrow(
      /check constraint/,
    );
  });

  it("ends when the connection ends", async () => {
    const { a, cid, jid } = await activeJourney();
    await as(
      a,
      "update public.connections set ended_at = now(), ended_by = $2 where id = $1",
      [cid, a],
    );
    const r = await db.query(
      "select ended_at from public.journeys where id = $1",
      [jid],
    );
    expect(r.rows[0].ended_at).not.toBeNull();
  });
});

describe("levels", () => {
  it("go in order", async () => {
    const { a, b, jid } = await activeJourney();
    await expect(complete(a, jid, 2)).rejects.toThrow(/level_locked/);
    await complete(a, jid, 1);
    await complete(b, jid, 1);
    await complete(a, jid, 2);
  });

  it("keep the two of you within one level of each other", async () => {
    const { a, b, jid } = await activeJourney();
    await complete(a, jid, 1);
    await expect(complete(a, jid, 2)).rejects.toThrow(/wait_for_partner/);
    await complete(b, jid, 1);
    await complete(b, jid, 2);
    await complete(a, jid, 2);
    await complete(a, jid, 3);
  });

  it("can be replayed, keeping the best score", async () => {
    const { a, jid } = await activeJourney();
    await complete(a, jid, 1, 50);
    await complete(a, jid, 1, 100);
    await complete(a, jid, 1, 25);
    const r = await db.query(
      "select score from public.journey_progress where journey_id = $1",
      [jid],
    );
    expect(r.rows).toEqual([{ score: 100 }]);
  });

  it("need the path accepted first", async () => {
    const { a, cid } = await couple();
    const jid = await propose(a, cid);
    await expect(complete(a, jid, 1)).rejects.toThrow(/journey_not_active/);
  });

  it("can only be recorded through the rules", async () => {
    const { a, jid } = await activeJourney();
    await expect(
      as(
        a,
        "insert into public.journey_progress (journey_id, user_id, level) values ($1, $2, 9)",
        [jid, a],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("can't be recorded by outsiders or after the journey ends", async () => {
    const { a, b, jid } = await activeJourney();
    const stranger = await newMember();
    await expect(complete(stranger, jid, 1)).rejects.toThrow(
      /journey_not_active/,
    );
    await as(b, "update public.journeys set ended_at = now() where id = $1", [
      jid,
    ]);
    await expect(complete(a, jid, 1)).rejects.toThrow(/journey_not_active/);
  });

  it("are visible to both people, and nobody else", async () => {
    const { a, b, jid } = await activeJourney();
    await complete(a, jid, 1);
    expect(
      await as(
        b,
        "select level from public.journey_progress where journey_id = $1",
        [jid],
      ),
    ).toEqual([{ level: 1 }]);
    const stranger = await newMember();
    expect(
      await as(
        stranger,
        "select level from public.journey_progress where journey_id = $1",
        [jid],
      ),
    ).toEqual([]);
  });
});
