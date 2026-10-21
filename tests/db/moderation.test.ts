/**
 * Moderation: staff-only tables, stories (consent, review, what the public
 * sees), and suspending a member.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];

async function member({ verified = true }: { verified?: boolean } = {}) {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@test.local`]);
  created.push(id);
  await db.query(
    "update public.profiles set display_name = 'Member', city = 'Raleigh', state_code = 'NC', primary_photo_path = $2, id_verified_at = $3 where id = $1",
    [id, `${id}/p.webp`, verified ? new Date() : null],
  );
  return id;
}

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, values: unknown[] = []) {
  await db.query("begin");
  try {
    if (uid) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
    } else {
      await db.query("set local role anon");
    }
    const r = await db.query(sql, values);
    await db.query("commit");
    return r.rows as T[];
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

const STORY = "We met in the spring and talked for hours about our families and our faith. A year later, here we are.";
const submit = (uid: string, extra = "") =>
  as<{ id: string }>(
    uid,
    `insert into public.stories (author_id, display_name, partner_name, place, body${extra ? ", status" : ""})
     values ($1, 'Grace', 'Daniel', 'Raleigh, NC', $2${extra ? ", $3" : ""}) returning id`,
    extra ? [uid, STORY, extra] : [uid, STORY],
  ).then((r) => r[0].id);

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("staff-only data", () => {
  it("is invisible to members and visitors", async () => {
    const m = await member();
    await db.query("insert into public.staff (user_id, role) values ($1, 'admin')", [m]);
    for (const table of ["staff", "moderation_actions"]) {
      expect(await as(m, `select * from public.${table}`)).toEqual([]);
      await expect(as(null, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("member search and suspensions are server-only", async () => {
    const m = await member();
    await expect(as(m, "select * from public.staff_search_members('')")).rejects.toThrow(/permission denied/);
    await expect(as(m, "select public.suspend_member($1, $1, 'x')", [m])).rejects.toThrow(/permission denied/);
  });

  it("member search finds people by email or name", async () => {
    const m = await member();
    await db.query("update public.profiles set display_name = 'Zebulon' where id = $1", [m]);
    const byName = await db.query("select id from public.staff_search_members('zebul')");
    expect(byName.rows.map((r) => r.id)).toContain(m);
    const byEmail = await db.query("select id, email from public.staff_search_members($1)", [m.slice(0, 13)]);
    expect(byEmail.rows[0]).toMatchObject({ id: m, email: `${m}@test.local` });
  });
});

describe("stories", () => {
  it("are submitted for review by verified members", async () => {
    const m = await member();
    const id = await submit(m);
    const r = await db.query("select status from public.stories where id = $1", [id]);
    expect(r.rows[0].status).toBe("pending");
  });

  it("can't be published by their author", async () => {
    const m = await member();
    await expect(submit(m, "approved")).rejects.toThrow(/row-level security/);
  });

  it("need a verified member", async () => {
    const m = await member({ verified: false });
    await expect(submit(m)).rejects.toThrow(/row-level security/);
  });

  it("are limited to three waiting at once", async () => {
    const m = await member();
    for (let i = 0; i < 3; i++) await submit(m);
    await expect(submit(m)).rejects.toThrow(/too_many_pending/);
  });

  it("are public once approved, without saying who wrote them", async () => {
    const m = await member();
    const id = await submit(m);
    const before = await as(null, "select * from public.published_stories()");
    expect(before.map((s) => s.id)).not.toContain(id);
    await db.query("update public.stories set status = 'approved', published_at = now() where id = $1", [id]);
    const after = await as<Record<string, unknown>>(null, "select * from public.published_stories()");
    const story = after.find((s) => s.id === id)!;
    expect(story).toMatchObject({ display_name: "Grace", partner_name: "Daniel", place: "Raleigh, NC" });
    expect(story).not.toHaveProperty("author_id");
    // The table itself stays closed to visitors.
    await expect(as(null, "select * from public.stories")).rejects.toThrow(/permission denied/);
  });

  it("are hidden when the author is suspended", async () => {
    const m = await member();
    const id = await submit(m);
    await db.query("update public.stories set status = 'approved', published_at = now() where id = $1", [id]);
    await db.query("select public.suspend_member($1, null, 'test')", [m]);
    const rows = await as(null, "select id from public.published_stories()");
    expect(rows.map((s) => s.id)).not.toContain(id);
  });

  it("are only visible to their own author before approval", async () => {
    const m = await member();
    const other = await member();
    await submit(m);
    expect(await as(m, "select id from public.stories")).toHaveLength(1);
    expect(await as(other, "select id from public.stories where author_id = $1", [m])).toEqual([]);
  });
});

describe("suspending a member", () => {
  it("ends their connections and hides them", async () => {
    const a = await member();
    const b = await member();
    const c = await db.query(
      "insert into public.connections (user_a, user_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid)) returning id",
      [a, b],
    );
    await db.query("select public.suspend_member($1, null, 'harassment')", [a]);
    const conn = await db.query("select ended_at from public.connections where id = $1", [c.rows[0].id]);
    expect(conn.rows[0].ended_at).not.toBeNull();
    expect(await as(b, "select id from public.profiles where id = $1", [a])).toEqual([]);
    const log = await db.query("select action, note from public.moderation_actions where target_user = $1", [a]);
    expect(log.rows).toEqual([{ action: "suspend", note: "harassment" }]);
  });

  it("can be undone", async () => {
    const a = await member();
    await db.query("select public.suspend_member($1, null, 'mistake')", [a]);
    await db.query("select public.reinstate_member($1, null, 'appeal accepted')", [a]);
    const r = await db.query("select banned_at from public.profiles where id = $1", [a]);
    expect(r.rows[0].banned_at).toBeNull();
  });
});
