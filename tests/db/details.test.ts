/**
 * Details: what a free member may learn about someone's Premium profile (how
 * much they added, never what), and test-mode upgrades.
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
) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    return (await db.query(sql, values)).rows as T[];
  } finally {
    await db.query("rollback");
  }
}

/** Introduces `target` to `viewer` this week, as the wand would. */
async function introduce(viewer: string, target: string) {
  const b = await db.query(
    `insert into public.discovery_batches (user_id, week_start)
     values ($1, public.discovery_week())
     on conflict (user_id, week_start) do update set user_id = excluded.user_id
     returning id`,
    [viewer],
  );
  const n = await db.query(
    "select count(*)::int as n from public.discovery_batch_items where batch_id = $1",
    [b.rows[0].id],
  );
  await db.query(
    "insert into public.discovery_batch_items (batch_id, profile_id, position) values ($1, $2, $3)",
    [b.rows[0].id, target, n.rows[0].n + 1],
  );
}

const makePremium = (id: string) =>
  db.query(
    "update public.entitlements set tier = 'premium', source = 'simulated', expires_at = now() + interval '30 days' where user_id = $1",
    [id],
  );

const teaser = (viewer: string, target: string) =>
  asMember(viewer, "select * from public.premium_teaser($1)", [target]);

let owner: string;
beforeAll(async () => {
  await db.connect();
  owner = await newMember();
  await db.query(
    `update public.profile_premium set
       height_cm = 175, religion = 'prefer_not', ethnicity = 'other',
       hobbies = '{cooking,hiking}', profession = 'Teacher',
       video_path = $2,
       prompts = '[{"prompt":"perfect_sunday","answer":"Church, then a long lunch."}]'
     where profile_id = $1`,
    [owner, `${owner}/v.mp4`],
  );
  await db.query(
    `insert into public.profile_photos (profile_id, storage_path, position, moderation_status)
     values ($1, $2, 1, 'approved'), ($1, $3, 2, 'approved'), ($1, $4, 3, 'rejected')`,
    [owner, `${owner}/a.webp`, `${owner}/b.webp`, `${owner}/c.webp`],
  );
});
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("Premium teaser for free members", () => {
  it("tells someone introduced how much was added, not what", async () => {
    const viewer = await newMember();
    await introduce(viewer, owner);
    const rows = await teaser(viewer, owner);
    // height, ethnicity, hobbies, profession; "prefer not to say" isn't counted.
    expect(rows).toEqual([
      { extra_photos: 2, has_video: true, prompts: 1, details: 4 },
    ]);
  });

  it("still can't read the details themselves", async () => {
    const viewer = await newMember();
    await introduce(viewer, owner);
    expect(
      await asMember(
        viewer,
        "select * from public.profile_premium where profile_id = $1",
        [owner],
      ),
    ).toEqual([]);
    expect(
      await asMember(
        viewer,
        "select * from public.profile_photos where profile_id = $1",
        [owner],
      ),
    ).toEqual([]);
  });

  it("says nothing about people the viewer wasn't introduced to", async () => {
    const stranger = await newMember();
    expect(await teaser(stranger, owner)).toEqual([]);
  });

  it("says nothing once either person blocks the other", async () => {
    const viewer = await newMember();
    await introduce(viewer, owner);
    await db.query(
      "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)",
      [owner, viewer],
    );
    expect(await teaser(viewer, owner)).toEqual([]);
  });

  it("isn't available without signing in", async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await expect(
        db.query("select * from public.premium_teaser($1)", [owner]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.query("rollback");
    }
  });
});

describe("Premium members", () => {
  it("read the full Premium profile of someone introduced", async () => {
    const viewer = await newMember();
    await introduce(viewer, owner);
    await makePremium(viewer);
    const [row] = await asMember<{ profession: string }>(
      viewer,
      "select profession from public.profile_premium where profile_id = $1",
      [owner],
    );
    expect(row.profession).toBe("Teacher");
    const photos = await asMember(
      viewer,
      "select storage_path from public.profile_photos where profile_id = $1",
      [owner],
    );
    expect(photos).toHaveLength(2);
  });

  it("lose access when Premium runs out", async () => {
    const viewer = await newMember();
    await introduce(viewer, owner);
    await db.query(
      "update public.entitlements set tier = 'premium', source = 'simulated', expires_at = now() - interval '1 minute' where user_id = $1",
      [viewer],
    );
    expect(
      await asMember(
        viewer,
        "select 1 from public.profile_premium where profile_id = $1",
        [owner],
      ),
    ).toEqual([]);
  });
});

describe("entitlements", () => {
  it("can't be changed by members themselves", async () => {
    const me = await newMember();
    await expect(
      asMember(
        me,
        "update public.entitlements set tier = 'premium' where user_id = $1",
        [me],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("let members check whether they are Premium", async () => {
    const me = await newMember();
    expect(
      await asMember(me, "select public.is_premium($1) as p", [me]),
    ).toEqual([{ p: false }]);
    await makePremium(me);
    expect(
      await asMember(me, "select public.is_premium($1) as p", [me]),
    ).toEqual([{ p: true }]);
  });
});
