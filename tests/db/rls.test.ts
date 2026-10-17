/**
 * Database privacy rules, tested against a real Postgres with the migrations
 * applied. Run with `npm run test:db` while `npx supabase start` is running
 * (or set DATABASE_URL to another database).
 *
 * Each check acts as a specific signed-in user, the same way the browser
 * would, so these prove what a person can and cannot reach even if they
 * bypass the app and call the API directly.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });

const alice = randomUUID(); // Premium
const ben = randomUUID(); // Free
const cara = randomUUID(); // Stranger to both

type Q = (text: string, values?: unknown[]) => Promise<pg.QueryResult>;

/** Run `fn` as a signed-in user. Changes are rolled back unless `commit`. */
async function as<T>(uid: string, fn: (q: Q) => Promise<T>, commit = false) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    const result = await fn((text, values) => db.query(text, values));
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function rows(uid: string, text: string, values?: unknown[]) {
  return as(uid, async (q) => (await q(text, values)).rows);
}

beforeAll(async () => {
  await db.connect();
  for (const [id, name] of [
    [alice, "Alice"],
    [ben, "Ben"],
    [cara, "Cara"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${id}@test.local`,
    ]);
    await db.query(
      "update public.profiles set display_name = $2 where id = $1",
      [id, name],
    );
    await db.query(
      "insert into public.profile_premium (profile_id, height_cm, religion) values ($1, 170, 'christian')",
      [id],
    );
  }
  await db.query(
    "update public.entitlements set tier = 'premium', source = 'manual' where user_id = $1",
    [alice],
  );
  // Alice and Ben each appear in the other's weekly Discover set.
  for (const [owner, shown] of [
    [alice, ben],
    [ben, alice],
  ]) {
    const { rows: b } = await db.query(
      "insert into public.discovery_batches (user_id, week_start) values ($1, current_date) returning id",
      [owner],
    );
    await db.query(
      "insert into public.discovery_batch_items (batch_id, profile_id, position) values ($1, $2, 1)",
      [b[0].id, shown],
    );
  }
});

afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [
    [alice, ben, cara],
  ]);
  await db.end();
});

describe("signup", () => {
  it("creates a profile, preferences and a free entitlement for each new user", async () => {
    const { rows: r } = await db.query(
      "select tier from public.entitlements where user_id = $1",
      [ben],
    );
    expect(r).toEqual([{ tier: "free" }]);
    const { rowCount } = await db.query(
      "select 1 from public.preferences where profile_id = $1",
      [ben],
    );
    expect(rowCount).toBe(1);
  });
});

describe("profiles", () => {
  it("are visible to people whose Discover set includes them", async () => {
    const r = await rows(
      alice,
      "select display_name from public.profiles where id = $1",
      [ben],
    );
    expect(r).toEqual([{ display_name: "Ben" }]);
  });

  it("are hidden from strangers", async () => {
    expect(
      await rows(cara, "select 1 from public.profiles where id = $1", [alice]),
    ).toHaveLength(0);
    expect(await rows(cara, "select id from public.profiles")).toEqual([
      { id: cara },
    ]);
  });

  it("cannot be marked ID-verified by their owner", async () => {
    await as(
      ben,
      (q) =>
        q(
          "update public.profiles set id_verified_at = now(), display_name = 'Benjamin' where id = $1",
          [ben],
        ),
      true,
    );
    const { rows: r } = await db.query(
      "select id_verified_at, display_name from public.profiles where id = $1",
      [ben],
    );
    expect(r[0]).toEqual({ id_verified_at: null, display_name: "Benjamin" });
  });
});

describe("premium profile fields", () => {
  it("are readable by a Premium viewer", async () => {
    const r = await rows(
      alice,
      "select religion from public.profile_premium where profile_id = $1",
      [ben],
    );
    expect(r).toEqual([{ religion: "christian" }]);
  });

  it("are hidden from a free viewer, who still sees the overview", async () => {
    expect(
      await rows(
        ben,
        "select 1 from public.profile_premium where profile_id = $1",
        [alice],
      ),
    ).toHaveLength(0);
    expect(
      await rows(ben, "select 1 from public.profiles where id = $1", [alice]),
    ).toHaveLength(1);
  });

  it("are always readable by their owner", async () => {
    expect(
      await rows(
        ben,
        "select 1 from public.profile_premium where profile_id = $1",
        [ben],
      ),
    ).toHaveLength(1);
  });

  it("cannot be unlocked by a user granting themselves Premium", async () => {
    await expect(
      as(ben, (q) =>
        q(
          "update public.entitlements set tier = 'premium' where user_id = $1",
          [ben],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("preferences", () => {
  it("are private to their owner", async () => {
    expect(
      await rows(
        alice,
        "select 1 from public.preferences where profile_id = $1",
        [ben],
      ),
    ).toHaveLength(0);
  });
});

describe("choosing and connecting", () => {
  it("does not let a stranger choose someone they cannot see", async () => {
    await expect(
      as(cara, (q) =>
        q(
          "insert into public.choices (from_id, to_id, chosen) values ($1, $2, true)",
          [cara, alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps a one-sided choice secret", async () => {
    await as(
      alice,
      (q) =>
        q(
          "insert into public.choices (from_id, to_id, chosen) values ($1, $2, true)",
          [alice, ben],
        ),
      true,
    );
    expect(await rows(ben, "select * from public.choices")).toHaveLength(0);
    expect(await rows(ben, "select * from public.connections")).toHaveLength(0);
  });

  it("opens a connection when both choose each other", async () => {
    await as(
      ben,
      (q) =>
        q(
          "insert into public.choices (from_id, to_id, chosen) values ($1, $2, true)",
          [ben, alice],
        ),
      true,
    );
    expect(
      await rows(
        alice,
        "select 1 from public.connections where ended_at is null",
      ),
    ).toHaveLength(1);
    expect(await rows(cara, "select 1 from public.connections")).toHaveLength(
      0,
    );
  });
});

describe("chat", () => {
  let connectionId: string;

  beforeAll(async () => {
    const r = await rows(
      alice,
      "select id from public.connections where ended_at is null",
    );
    connectionId = r[0].id;
  });

  it("lets connected members send and read messages", async () => {
    await as(
      alice,
      (q) =>
        q(
          "insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'Hello Ben')",
          [connectionId, alice],
        ),
      true,
    );
    const r = await rows(
      ben,
      "select body from public.messages where connection_id = $1",
      [connectionId],
    );
    expect(r).toEqual([{ body: "Hello Ben" }]);
  });

  it("hides messages from anyone outside the connection", async () => {
    expect(await rows(cara, "select 1 from public.messages")).toHaveLength(0);
    await expect(
      as(cara, (q) =>
        q(
          "insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'hi')",
          [connectionId, cara],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let a member send as the other person", async () => {
    await expect(
      as(ben, (q) =>
        q(
          "insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'fake')",
          [connectionId, alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets only the recipient mark messages read", async () => {
    const byAlice = await as(
      alice,
      async (q) =>
        (await q("select public.mark_messages_read($1) as n", [connectionId]))
          .rows[0].n,
    );
    expect(byAlice).toBe(0);
    const byBen = await as(
      ben,
      async (q) =>
        (await q("select public.mark_messages_read($1) as n", [connectionId]))
          .rows[0].n,
      true,
    );
    expect(byBen).toBe(1);
  });
});

describe("Together journeys", () => {
  it("need the other person to accept", async () => {
    const jid = await as(
      alice,
      async (q) => {
        const r = await q(
          "insert into public.journeys (connection_id, path, proposed_by) select id, 'grow_a_tree', $1 from public.connections where ended_at is null returning id",
          [alice],
        );
        return r.rows[0].id as string;
      },
      true,
    );
    await expect(
      as(alice, (q) => q("select public.accept_journey($1)", [jid])),
    ).rejects.toThrow(/not yours to accept/);
    await as(ben, (q) => q("select public.accept_journey($1)", [jid]), true);
    const r = await rows(
      ben,
      "select accepted_at is not null as ok from public.journeys where id = $1",
      [jid],
    );
    expect(r).toEqual([{ ok: true }]);
  });

  it("allow only one open path per connection", async () => {
    await expect(
      as(ben, (q) =>
        q(
          "insert into public.journeys (connection_id, path, proposed_by) select id, 'write_a_book', $1 from public.connections where ended_at is null",
          [ben],
        ),
      ),
    ).rejects.toThrow(/journeys_one_open_idx/);
  });
});

describe("blocking", () => {
  it("ends the connection, closes the chat and hides both profiles", async () => {
    await as(
      ben,
      (q) =>
        q(
          "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)",
          [ben, alice],
        ),
      true,
    );
    expect(
      await rows(
        alice,
        "select 1 from public.connections where ended_at is null",
      ),
    ).toHaveLength(0);
    expect(
      await rows(alice, "select 1 from public.profiles where id = $1", [ben]),
    ).toHaveLength(0);
    expect(await rows(alice, "select 1 from public.messages")).toHaveLength(0);
  });

  it("is invisible to the person blocked", async () => {
    expect(await rows(alice, "select 1 from public.blocks")).toHaveLength(0);
  });
});
