/**
 * ID verification rules in the database: who can record results, what a
 * verified ID changes, and the limits on attempts.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const db = new pg.Client({ connectionString: url });
const created: string[] = [];

function yearsAgo(n: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
}

async function newMember(birthdate = yearsAgo(30)) {
  const id = randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${id}@test.local`, { birthdate }],
  );
  created.push(id);
  return id;
}

/** Runs as trusted server code, the way the app's service role does. */
const startSession = (userId: string, sessionId = `vs_${randomUUID()}`) =>
  db
    .query("select public.record_identity_session($1, 'stripe', $2)", [
      userId,
      sessionId,
    ])
    .then(() => sessionId);

const recordResult = (
  sessionId: string,
  status: string,
  documentType: string | null = null,
  birthdate: string | null = null,
  reason: string | null = null,
) =>
  db
    .query("select * from public.record_identity_result($1, $2, $3, $4, $5)", [
      sessionId,
      status,
      documentType,
      birthdate,
      reason,
    ])
    .then((r) => r.rows[0] as { user_id: string; status: string });

async function asMember<T>(uid: string, sql: string, values: unknown[] = []) {
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

const profile = (id: string) =>
  db
    .query(
      "select id_verified_at is not null as verified, to_char(birthdate, 'YYYY-MM-DD') as birthdate from public.profiles where id = $1",
      [id],
    )
    .then((r) => r.rows[0]);

beforeAll(() => db.connect());
afterAll(async () => {
  await db.query("delete from auth.users where id = any($1)", [created]);
  await db.end();
});

describe("a successful verification", () => {
  it("marks the member verified and uses the date of birth from the ID", async () => {
    const id = await newMember(yearsAgo(30));
    const session = await startSession(id);
    const fromId = yearsAgo(31);
    const r = await recordResult(session, "verified", "passport", fromId);
    expect(r).toEqual({ user_id: id, status: "verified" });
    expect(await profile(id)).toEqual({ verified: true, birthdate: fromId });
  });

  it("is final: later reports for the same attempt change nothing", async () => {
    const id = await newMember();
    const session = await startSession(id);
    await recordResult(session, "verified", "driving_license", yearsAgo(40));
    const again = await recordResult(
      session,
      "requires_input",
      null,
      null,
      "document_expired",
    );
    expect(again.status).toBe("verified");
  });

  it("stops the member from starting another attempt", async () => {
    const id = await newMember();
    await recordResult(
      await startSession(id),
      "verified",
      "id_card",
      yearsAgo(25),
    );
    await expect(startSession(id)).rejects.toThrow(/already_verified/);
  });

  it("locks the date of birth against later edits by the member", async () => {
    const id = await newMember();
    const fromId = yearsAgo(33);
    await recordResult(await startSession(id), "verified", "passport", fromId);
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id, role: "authenticated" }),
    ]);
    await db.query("update public.profiles set birthdate = $2 where id = $1", [
      id,
      yearsAgo(26),
    ]);
    await db.query("commit");
    expect((await profile(id)).birthdate).toBe(fromId);
  });
});

describe("an ID showing the member is under 18", () => {
  it("is rejected, leaves them unverified, and blocks further attempts", async () => {
    const id = await newMember(yearsAgo(19));
    const r = await recordResult(
      await startSession(id),
      "verified",
      "driving_license",
      yearsAgo(17),
    );
    expect(r.status).toBe("rejected");
    expect((await profile(id)).verified).toBe(false);
    await expect(startSession(id)).rejects.toThrow(/underage/);
  });
});

describe("a failed attempt", () => {
  it("keeps the reason and lets the member try again", async () => {
    const id = await newMember();
    const s = await startSession(id);
    await recordResult(s, "requires_input", null, null, "document_expired");
    const rows = await asMember<{ status: string; failure_reason: string }>(
      id,
      "select status, failure_reason from public.identity_verifications where provider_session_id = $1",
      [s],
    );
    expect(rows).toEqual([
      { status: "requires_input", failure_reason: "document_expired" },
    ]);
    await expect(startSession(id)).resolves.toBeTruthy();
  });

  it("counts a verified result with no readable birthdate as a failure", async () => {
    const id = await newMember();
    const r = await recordResult(
      await startSession(id),
      "verified",
      "passport",
      null,
    );
    expect(r.status).toBe("requires_input");
    expect((await profile(id)).verified).toBe(false);
  });
});

describe("limits", () => {
  it("allow at most 5 attempts in 24 hours", async () => {
    const id = await newMember();
    for (let i = 0; i < 5; i++) await startSession(id);
    await expect(startSession(id)).rejects.toThrow(/too_many_attempts/);
  });
});

describe("members", () => {
  it("can read only their own attempts", async () => {
    const a = await newMember();
    const b = await newMember();
    await startSession(a);
    expect(
      await asMember(
        b,
        "select 1 from public.identity_verifications where user_id = $1",
        [a],
      ),
    ).toHaveLength(0);
  });

  it("cannot record a result or mark themselves verified", async () => {
    const a = await newMember();
    const s = await startSession(a);
    await expect(
      asMember(
        a,
        "select * from public.record_identity_result($1, 'verified', 'passport', '1990-01-01')",
        [s],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asMember(
        a,
        "update public.identity_verifications set status = 'verified' where user_id = $1",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
    await asMember(
      a,
      "update public.profiles set id_verified_at = now() where id = $1",
      [a],
    );
    expect((await profile(a)).verified).toBe(false);
  });
});
