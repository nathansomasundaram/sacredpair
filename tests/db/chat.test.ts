/**
 * Connect and Chat: when a connection opens and closes, who can read and
 * send messages, read receipts, the Chat list, and reports.
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

/** Runs SQL as a signed-in member; commits only when asked. */
async function as<T = Record<string, unknown>>(
  uid: string,
  sql: string,
  values: unknown[] = [],
  commit = true,
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

const choose = (from: string, to: string, chosen = true) =>
  as(
    from,
    `insert into public.choices (from_id, to_id, chosen) values ($1, $2, $3)
     on conflict (from_id, to_id) do update set chosen = excluded.chosen`,
    [from, to, chosen],
  );

const liveConnection = (a: string, b: string) =>
  db
    .query(
      `select id from public.connections
       where user_a = least($1::uuid, $2::uuid) and user_b = greatest($1::uuid, $2::uuid)
         and ended_at is null`,
      [a, b],
    )
    .then((r) => (r.rows[0]?.id as string | undefined) ?? null);

const makePremium = (...ids: string[]) =>
  db.query(
    "update public.entitlements set tier = 'premium', source = 'simulated', expires_at = now() + interval '30 days' where user_id = any($1)",
    [ids],
  );

/**
 * Two members introduced to each other who both chose each other. Both
 * have Premium unless `premium` is false (Chat needs both on Premium).
 */
async function connectedPair({ premium = true } = {}) {
  const a = await newMember();
  const b = await newMember();
  if (premium) await makePremium(a, b);
  await introduce(a, b);
  await introduce(b, a);
  await choose(a, b);
  await choose(b, a);
  const cid = await liveConnection(a, b);
  if (!cid) throw new Error("expected a connection");
  return { a, b, cid };
}

const send = (from: string, cid: string, body: string) =>
  as<{ id: string }>(
    from,
    "insert into public.messages (connection_id, sender_id, body) values ($1, $2, $3) returning id",
    [cid, from, body],
  ).then((r) => r[0].id);

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("connecting", () => {
  it("opens a connection only when both choose each other", async () => {
    const a = await newMember();
    const b = await newMember();
    await introduce(a, b);
    await introduce(b, a);
    await choose(a, b);
    expect(await liveConnection(a, b)).toBeNull();
    await choose(b, a);
    expect(await liveConnection(a, b)).not.toBeNull();
  });

  it("keeps a one-sided choice private", async () => {
    const a = await newMember();
    const b = await newMember();
    await introduce(a, b);
    await choose(a, b);
    expect(
      await as(b, "select * from public.choices where to_id = $1", [b], false),
    ).toEqual([]);
  });

  it("can't choose someone you weren't introduced to", async () => {
    const a = await newMember();
    const b = await newMember();
    await expect(choose(a, b)).rejects.toThrow(/row-level security/);
  });

  it("doesn't connect when one passed", async () => {
    const a = await newMember();
    const b = await newMember();
    await introduce(a, b);
    await introduce(b, a);
    await choose(a, b);
    await choose(b, a, false);
    expect(await liveConnection(a, b)).toBeNull();
  });

  it("doesn't reopen a connection after it ended", async () => {
    const { a, b, cid } = await connectedPair();
    await as(
      a,
      "update public.connections set ended_at = now(), ended_by = $2 where id = $1",
      [cid, a],
    );
    await choose(a, b); // choosing again
    await choose(b, a);
    expect(await liveConnection(a, b)).toBeNull();
  });
});

describe("messages", () => {
  it("only the two members can read and send", async () => {
    const { a, b, cid } = await connectedPair();
    const stranger = await newMember();
    await send(a, cid, "Hello!");
    expect(
      await as(
        b,
        "select body from public.messages where connection_id = $1",
        [cid],
        false,
      ),
    ).toEqual([{ body: "Hello!" }]);
    expect(
      await as(
        stranger,
        "select body from public.messages where connection_id = $1",
        [cid],
        false,
      ),
    ).toEqual([]);
    await expect(send(stranger, cid, "Hi")).rejects.toThrow(
      /row-level security/,
    );
  });

  it("can't be sent as someone else", async () => {
    const { a, b, cid } = await connectedPair();
    await expect(
      as(
        a,
        "insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'x')",
        [cid, b],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't be blank or too long", async () => {
    const { a, cid } = await connectedPair();
    await expect(send(a, cid, "   ")).rejects.toThrow(
      /messages_body_not_blank/,
    );
    await expect(send(a, cid, "x".repeat(2001))).rejects.toThrow(
      /check constraint/,
    );
  });

  it("stop when the connection ends, for both people", async () => {
    const { a, b, cid } = await connectedPair();
    await send(a, cid, "Hello");
    await as(
      b,
      "update public.connections set ended_at = now(), ended_by = $2 where id = $1",
      [cid, b],
    );
    await expect(send(a, cid, "Still there?")).rejects.toThrow(
      /row-level security/,
    );
    expect(
      await as(
        a,
        "select 1 from public.messages where connection_id = $1",
        [cid],
        false,
      ),
    ).toEqual([]);
  });

  it("stop when either person blocks the other", async () => {
    const { a, b, cid } = await connectedPair();
    await as(
      b,
      "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)",
      [b, a],
    );
    expect(await liveConnection(a, b)).toBeNull();
    await expect(send(a, cid, "Hello?")).rejects.toThrow(/row-level security/);
  });

  it("are limited to 30 a minute", async () => {
    const { a, cid } = await connectedPair();
    for (let i = 0; i < 30; i++) await send(a, cid, `Message ${i}`);
    await expect(send(a, cid, "One too many")).rejects.toThrow(/rate_limited/);
  });

  it("can't be edited by members", async () => {
    const { a, cid } = await connectedPair();
    const id = await send(a, cid, "Original");
    await as(a, "update public.messages set body = 'Changed' where id = $1", [
      id,
    ]).catch(() => {});
    const r = await db.query("select body from public.messages where id = $1", [
      id,
    ]);
    expect(r.rows[0].body).toBe("Original");
  });
});

describe("Premium", () => {
  it("is needed by both people to read or send", async () => {
    const { a, b, cid } = await connectedPair({ premium: false });
    await expect(send(a, cid, "Hello")).rejects.toThrow(/row-level security/);

    await makePremium(a);
    await expect(send(a, cid, "Hello")).rejects.toThrow(/row-level security/);
    await expect(
      as(a, "select public.mark_messages_read($1)", [cid]),
    ).rejects.toThrow(/premium_required/);

    await makePremium(b);
    await send(a, cid, "Hello");
    expect(
      await as(b, "select body from public.messages where connection_id = $1", [
        cid,
      ]),
    ).toEqual([{ body: "Hello" }]);
  });

  it("closes the conversation, without deleting it, when Premium ends", async () => {
    const { a, b, cid } = await connectedPair();
    await send(a, cid, "Kept safe");
    await db.query(
      "update public.entitlements set expires_at = now() - interval '1 minute' where user_id = $1",
      [b],
    );
    expect(
      await as(a, "select 1 from public.messages where connection_id = $1", [
        cid,
      ]),
    ).toHaveLength(0);
    // The Chat list still shows the connection, without the message.
    expect(
      await as(a, "select last_body, unread from public.my_conversations()"),
    ).toEqual([{ last_body: null, unread: 0 }]);
    expect(
      await as(a, "select access from public.my_connection_access()"),
    ).toEqual([{ access: "waiting" }]);

    await makePremium(b);
    expect(
      await as(a, "select body from public.messages where connection_id = $1", [
        cid,
      ]),
    ).toEqual([{ body: "Kept safe" }]);
  });
});

describe("read receipts", () => {
  it("only the recipient marks messages read", async () => {
    const { a, b, cid } = await connectedPair();
    await send(a, cid, "One");
    await send(a, cid, "Two");
    expect(
      await as(a, "select public.mark_messages_read($1) as n", [cid]),
    ).toEqual([{ n: 0 }]);
    expect(
      await as(b, "select public.mark_messages_read($1) as n", [cid]),
    ).toEqual([{ n: 2 }]);
    const r = await db.query(
      "select count(*)::int as n from public.messages where connection_id = $1 and read_at is not null",
      [cid],
    );
    expect(r.rows[0].n).toBe(2);
  });

  it("outsiders can't mark anything read", async () => {
    const { a, cid } = await connectedPair();
    const stranger = await newMember();
    await send(a, cid, "Hello");
    await expect(
      as(stranger, "select public.mark_messages_read($1)", [cid]),
    ).rejects.toThrow(/not a member/);
  });
});

describe("the Chat list", () => {
  it("shows each live conversation with its latest message and unread count", async () => {
    const { a, b, cid } = await connectedPair();
    await send(a, cid, "First");
    await send(a, cid, "Second");
    const rows = await as<{
      connection_id: string;
      other_id: string;
      last_body: string;
      unread: number;
    }>(b, "select * from public.my_conversations()", [], false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      connection_id: cid,
      other_id: a,
      last_body: "Second",
      unread: 2,
    });
    const mine = await as<{ unread: number }>(
      a,
      "select * from public.my_conversations()",
      [],
      false,
    );
    expect(mine[0].unread).toBe(0);
  });

  it("drops conversations that ended", async () => {
    const { a, cid } = await connectedPair();
    await as(
      a,
      "update public.connections set ended_at = now(), ended_by = $2 where id = $1",
      [cid, a],
    );
    expect(
      await as(a, "select * from public.my_conversations()", [], false),
    ).toEqual([]);
  });
});

describe("reports", () => {
  const report = (
    from: string,
    about: string,
    extra: { connection?: string | null; message?: string | null } = {},
  ) =>
    as(
      from,
      `insert into public.reports (reporter_id, reported_id, reason, details, connection_id, message_id)
       values ($1, $2, 'harassment', 'Rude messages', $3, $4)`,
      [from, about, extra.connection ?? null, extra.message ?? null],
    );

  it("can be filed about someone you met, with the conversation", async () => {
    const { a, b, cid } = await connectedPair();
    const msg = await send(b, cid, "Something rude");
    await report(a, b, { connection: cid, message: msg });
    const r = await db.query(
      "select reason, connection_id, message_id::text from public.reports where reporter_id = $1",
      [a],
    );
    expect(r.rows).toEqual([
      { reason: "harassment", connection_id: cid, message_id: msg },
    ]);
  });

  it("still works after the connection ended", async () => {
    const { a, b, cid } = await connectedPair();
    await as(
      a,
      "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)",
      [a, b],
    );
    await report(a, b, { connection: cid });
  });

  it("can't be filed about strangers", async () => {
    const a = await newMember();
    const b = await newMember();
    await expect(report(a, b)).rejects.toThrow(/row-level security/);
  });

  it("can't point at someone else's conversation or message", async () => {
    const { a, b, cid } = await connectedPair();
    const other = await connectedPair();
    const theirMsg = await send(other.a, other.cid, "Not yours");
    await expect(report(a, b, { connection: other.cid })).rejects.toThrow(
      /row-level security/,
    );
    await expect(report(a, b, { message: theirMsg })).rejects.toThrow(
      /row-level security/,
    );
    // Nor your own message as theirs.
    const mine = await send(a, cid, "Mine");
    await expect(report(a, b, { message: mine })).rejects.toThrow(
      /row-level security/,
    );
  });

  it("keeps one open report per person", async () => {
    const { a, b } = await connectedPair();
    await report(a, b);
    await expect(report(a, b)).rejects.toThrow(/reports_one_open_idx/);
  });

  it("aren't visible to the person reported", async () => {
    const { a, b } = await connectedPair();
    await report(a, b);
    expect(await as(b, "select * from public.reports", [], false)).toEqual([]);
  });
});
