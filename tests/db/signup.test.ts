/**
 * What happens in the database when someone signs up. Sign-up details reach
 * the database as auth user metadata; these tests insert auth users the same
 * way Supabase Auth does and check where each detail ends up.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];

function adultBirthdate() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 30);
  return d.toISOString().slice(0, 10);
}

async function signUp(meta: Record<string, unknown>) {
  const id = randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${id}@test.local`, meta],
  );
  created.push(id);
  return id;
}

async function asUser<T>(uid: string, sql: string, values: unknown[] = []) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    const r = await db.query(sql, values);
    await db.query("rollback");
    return r.rows as T[];
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

beforeAll(() => db.connect());

afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("sign up", () => {
  it("saves each detail in its own place", async () => {
    const birthdate = adultBirthdate();
    const id = await signUp({
      birthdate,
      phone: "+15551234567",
      marketing_emails: true,
      accepted_terms: true,
      terms_version: "2026-10-18",
    });

    const profile = await db.query(
      "select to_char(birthdate, 'YYYY-MM-DD') as birthdate from public.profiles where id = $1",
      [id],
    );
    expect(profile.rows[0].birthdate).toBe(birthdate);

    const prefs = await db.query(
      "select marketing_emails from public.preferences where profile_id = $1",
      [id],
    );
    expect(prefs.rows[0].marketing_emails).toBe(true);

    const priv = await db.query(
      "select phone, terms_version, terms_accepted_at is not null as accepted from public.account_private where user_id = $1",
      [id],
    );
    expect(priv.rows[0]).toEqual({
      phone: "+15551234567",
      terms_version: "2026-10-18",
      accepted: true,
    });
  });

  it("does not record terms acceptance unless it was given", async () => {
    const id = await signUp({ birthdate: adultBirthdate() });
    const priv = await db.query(
      "select terms_accepted_at, phone from public.account_private where user_id = $1",
      [id],
    );
    expect(priv.rows[0]).toEqual({ terms_accepted_at: null, phone: null });
  });

  it("rejects anyone under 18", async () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 17);
    await expect(
      signUp({ birthdate: d.toISOString().slice(0, 10) }),
    ).rejects.toThrow(/profiles_birthdate_check/);
  });

  it("rejects a badly formatted phone number", async () => {
    await expect(
      signUp({ birthdate: adultBirthdate(), phone: "555-1234" }),
    ).rejects.toThrow(/account_private_phone_check/);
  });
});

describe("private account details", () => {
  it("are visible to their owner only", async () => {
    const a = await signUp({
      birthdate: adultBirthdate(),
      phone: "+15550000001",
    });
    const b = await signUp({ birthdate: adultBirthdate() });
    expect(await asUser(a, "select phone from public.account_private")).toEqual(
      [{ phone: "+15550000001" }],
    );
    expect(
      await asUser(
        b,
        "select 1 from public.account_private where user_id = $1",
        [a],
      ),
    ).toHaveLength(0);
  });

  it("let the owner change their phone, which clears its verification", async () => {
    const a = await signUp({
      birthdate: adultBirthdate(),
      phone: "+15550000002",
    });
    await db.query(
      "update public.account_private set phone_verified_at = now() where user_id = $1",
      [a],
    );
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: a, role: "authenticated" }),
    ]);
    await db.query(
      "update public.account_private set phone = '+15550000003' where user_id = $1",
      [a],
    );
    await db.query("commit");
    const r = await db.query(
      "select phone, phone_verified_at from public.account_private where user_id = $1",
      [a],
    );
    expect(r.rows[0]).toEqual({
      phone: "+15550000003",
      phone_verified_at: null,
    });
  });

  it("do not let the owner fake phone verification or terms acceptance", async () => {
    const a = await signUp({ birthdate: adultBirthdate() });
    await expect(
      asUser(
        a,
        "update public.account_private set phone_verified_at = now() where user_id = $1",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        a,
        "update public.account_private set terms_accepted_at = now() where user_id = $1",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
