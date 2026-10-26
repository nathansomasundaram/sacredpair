/**
 * Coupon codes: who can see them, which codes can be used, and that a code
 * with a limit can't be oversold.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const users: string[] = [];
const coupons: string[] = [];

async function member() {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    `${id}@test.local`,
  ]);
  users.push(id);
  return id;
}

async function as<T = Record<string, unknown>>(
  uid: string | null,
  sql: string,
  values: unknown[] = [],
) {
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

type Fields = {
  percent_off?: number | null;
  amount_off_cents?: number | null;
  duration?: string;
  duration_months?: number | null;
  plans?: string[];
  members_only?: boolean;
  max_redemptions?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  active?: boolean;
};

async function coupon(fields: Fields = {}) {
  const code = `T${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const f = { percent_off: 20, plans: ["monthly", "yearly"], ...fields };
  const { rows } = await db.query(
    `insert into public.coupons
       (code, percent_off, amount_off_cents, duration, duration_months, plans,
        members_only, max_redemptions, starts_at, expires_at, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [
      code,
      f.percent_off,
      f.amount_off_cents ?? null,
      f.duration ?? "once",
      f.duration_months ?? null,
      f.plans,
      f.members_only ?? false,
      f.max_redemptions ?? null,
      f.starts_at ?? null,
      f.expires_at ?? null,
      f.active ?? true,
    ],
  );
  coupons.push(rows[0].id);
  return { id: rows[0].id as string, code };
}

async function preview(code: string, user: string, plan = "monthly") {
  const { rows } = await db.query(
    "select * from public.coupon_preview($1, $2, $3)",
    [code, user, plan],
  );
  return rows[0] as {
    coupon_id: string | null;
    percent_off: number | null;
    amount_off_cents: number | null;
    error: string | null;
  };
}

async function claim(code: string, user: string, plan = "monthly") {
  const { rows } = await db.query(
    "select * from public.claim_coupon($1, $2, $3)",
    [code, user, plan],
  );
  return rows[0] as { coupon_id: string | null; error: string | null };
}

beforeAll(() => db.connect());
afterAll(async () => {
  if (coupons.length) {
    await db.query("delete from public.coupons where id = any($1)", [coupons]);
  }
  if (users.length) {
    await db.query("delete from auth.users where id = any($1)", [users]);
  }
  await db.end();
});

describe("who can reach coupons", () => {
  it("keeps the tables away from members and visitors", async () => {
    const me = await member();
    const c = await coupon();
    await expect(as(me, "select * from public.coupons")).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(null, "select * from public.coupons")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(me, "select * from public.coupon_redemptions"),
    ).rejects.toThrow(/permission denied/);
    await expect(as(me, "select * from public.coupon_members")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(me, "select * from public.coupon_partners"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(
        me,
        "insert into public.coupons (code, percent_off) values ('HACKME1', 100)",
      ),
    ).rejects.toThrow(/permission denied/);
    expect(c.id).toBeTruthy();
  });

  it("keeps the functions away from members, so nobody can claim for someone else", async () => {
    const me = await member();
    const c = await coupon();
    for (const sql of [
      "select * from public.coupon_check($1, $2, 'monthly')",
      "select * from public.coupon_preview($1, $2, 'monthly')",
      "select * from public.claim_coupon($1, $2, 'monthly')",
    ]) {
      await expect(as(me, sql, [c.code, me])).rejects.toThrow(
        /permission denied/,
      );
      await expect(as(null, sql, [c.code, me])).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      as(me, "select public.coupon_complete('cs_x')"),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("what makes a code usable", () => {
  it("accepts a plain code, however it is typed", async () => {
    const me = await member();
    const c = await coupon({ percent_off: 25 });
    const r = await preview(`  ${c.code.toLowerCase()} `, me);
    expect(r.error).toBeNull();
    expect(r.percent_off).toBe(25);
    expect(r.coupon_id).toBe(c.id);
  });

  it("turns away unknown, switched-off, early and expired codes", async () => {
    const me = await member();
    expect((await preview("NOSUCHCODE", me)).error).toBe("not_found");
    expect(
      (await preview((await coupon({ active: false })).code, me)).error,
    ).toBe("inactive");
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      (await preview((await coupon({ starts_at: future })).code, me)).error,
    ).toBe("not_started");
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      (await preview((await coupon({ expires_at: past })).code, me)).error,
    ).toBe("expired");
  });

  it("applies only to the plans it names", async () => {
    const me = await member();
    const c = await coupon({ plans: ["yearly"] });
    expect((await preview(c.code, me, "monthly")).error).toBe("wrong_plan");
    expect((await preview(c.code, me, "yearly")).error).toBeNull();
  });

  it("a members-only code is invisible to everyone it wasn't plugged into", async () => {
    const chosen = await member();
    const other = await member();
    const c = await coupon({ members_only: true });
    await db.query(
      "insert into public.coupon_members (coupon_id, user_id) values ($1, $2)",
      [c.id, chosen],
    );
    expect((await preview(c.code, chosen)).error).toBeNull();
    // Looks the same as a code that doesn't exist.
    expect((await preview(c.code, other)).error).toBe("not_found");
  });

  it("can be used once per member", async () => {
    const me = await member();
    const c = await coupon();
    expect((await claim(c.code, me)).error).toBeNull();
    await db.query(
      "update public.coupon_redemptions set stripe_session_id = 'cs_once_' || id where coupon_id = $1",
      [c.id],
    );
    const { rows } = await db.query(
      "select stripe_session_id from public.coupon_redemptions where coupon_id = $1",
      [c.id],
    );
    await db.query("select public.coupon_complete($1)", [
      rows[0].stripe_session_id,
    ]);
    expect((await preview(c.code, me)).error).toBe("already_used");
    expect((await claim(c.code, me)).error).toBe("already_used");
  });
});

describe("codes with a limit", () => {
  it("can't be oversold while a checkout holds the last use", async () => {
    const first = await member();
    const second = await member();
    const c = await coupon({ max_redemptions: 1 });
    expect((await claim(c.code, first)).error).toBeNull();
    expect((await claim(c.code, second)).error).toBe("exhausted");
    // The member holding it can come back to the same checkout.
    expect((await claim(c.code, first)).error).toBeNull();
  });

  it("is free again when a hold lapses unpaid", async () => {
    const first = await member();
    const second = await member();
    const c = await coupon({ max_redemptions: 1 });
    await claim(c.code, first);
    await db.query(
      "update public.coupon_redemptions set reserved_until = now() - interval '1 minute' where coupon_id = $1",
      [c.id],
    );
    expect((await claim(c.code, second)).error).toBeNull();
  });

  it("stays used after the payment is confirmed, once", async () => {
    const first = await member();
    const second = await member();
    const c = await coupon({ max_redemptions: 1 });
    await claim(c.code, first);
    await db.query(
      "select public.coupon_attach_session($1, $2, 'cs_test_limit')",
      [c.id, first],
    );
    const done = await db.query(
      "select public.coupon_complete('cs_test_limit') as ok",
    );
    expect(done.rows[0].ok).toBe(true);
    const again = await db.query(
      "select public.coupon_complete('cs_test_limit') as ok",
    );
    expect(again.rows[0].ok).toBe(false);
    await db.query(
      "update public.coupon_redemptions set reserved_until = now() - interval '1 day' where coupon_id = $1",
      [c.id],
    );
    expect((await claim(c.code, second)).error).toBe("exhausted");
  });

  it("lets two checkouts for the last use take turns", async () => {
    const people = [
      await member(),
      await member(),
      await member(),
      await member(),
    ];
    const c = await coupon({ max_redemptions: 2 });
    const clients = await Promise.all(
      people.map(async () => {
        const client = new pg.Client({ connectionString: url });
        await client.connect();
        return client;
      }),
    );
    try {
      const results = await Promise.all(
        clients.map((client, i) =>
          client
            .query("select * from public.claim_coupon($1, $2, 'monthly')", [
              c.code,
              people[i],
            ])
            .then((r) => r.rows[0].error as string | null),
        ),
      );
      expect(results.filter((e) => e === null)).toHaveLength(2);
      expect(results.filter((e) => e === "exhausted")).toHaveLength(2);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });
});

describe("what a code can be made of", () => {
  it("is a percentage or an amount, never both or neither", async () => {
    await expect(
      coupon({ percent_off: 10, amount_off_cents: 500 }),
    ).rejects.toThrow(/violates check constraint/);
    await expect(
      coupon({ percent_off: null, amount_off_cents: null }),
    ).rejects.toThrow(/violates check constraint/);
    const amount = await coupon({ percent_off: null, amount_off_cents: 500 });
    expect((await preview(amount.code, await member())).amount_off_cents).toBe(
      500,
    );
  });

  it("names its length only when repeating", async () => {
    await expect(coupon({ duration: "repeating" })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(
      coupon({ duration: "once", duration_months: 3 }),
    ).rejects.toThrow(/violates check constraint/);
    await coupon({ duration: "repeating", duration_months: 3 });
  });

  it("is stored in upper case, with only letters, numbers, dashes and underscores", async () => {
    for (const code of ["lowercase1", "HAS SPACE", "AB", "BAD!CODE"]) {
      await expect(
        db.query(
          "insert into public.coupons (code, percent_off) values ($1, 10)",
          [code],
        ),
      ).rejects.toThrow(/violates check constraint/);
    }
  });

  it("can't go over 100 percent or have no plans", async () => {
    await expect(coupon({ percent_off: 101 })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(coupon({ plans: [] })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(coupon({ plans: ["weekly"] })).rejects.toThrow(
      /violates check constraint/,
    );
  });

  it("has a unique code", async () => {
    const c = await coupon();
    await expect(
      db.query(
        "insert into public.coupons (code, percent_off) values ($1, 10)",
        [c.code],
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});
