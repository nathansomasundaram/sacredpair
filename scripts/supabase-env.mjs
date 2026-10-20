#!/usr/bin/env node
/**
 * Writes the running local Supabase's URLs and keys into your settings, so
 * no key is ever written into the code.
 *
 *   npm run env:local                  -> .env.local (app, tests) and .env (Docker Compose)
 *   node scripts/supabase-env.mjs --github-env   -> appends to $GITHUB_ENV (CI)
 *
 * Needs Supabase running (npm run db:start). Other settings already in
 * .env.local or .env (for example IDENTITY_PROVIDER) are kept.
 *
 * Works with both the newer key names (PUBLISHABLE_KEY, SECRET_KEY) and the
 * older ones (ANON_KEY, SERVICE_ROLE_KEY) printed by different CLI versions.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function readStatus() {
  let out;
  try {
    out = execFileSync(
      "npx",
      ["--no-install", "supabase", "status", "-o", "env"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      },
    );
  } catch (error) {
    console.error(
      "Couldn't read Supabase status. Start it first with: npm run db:start\n",
      error.stderr?.toString() ?? error.message,
    );
    process.exit(1);
  }
  const values = {};
  for (const line of out.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/.exec(line.trim());
    if (m) values[m[1]] = m[2] ?? m[3];
  }
  return values;
}

const s = readStatus();
const pick = (...names) => names.map((n) => s[n]).find(Boolean);

const settings = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
  DATABASE_URL: pick("DB_URL"),
  MAILPIT_URL: pick("MAILPIT_URL", "INBUCKET_URL"),
};

const missing = Object.entries(settings)
  .filter(([key, value]) => !value && key !== "MAILPIT_URL")
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(`Supabase status didn't include: ${missing.join(", ")}`);
  console.error(`It printed: ${Object.keys(s).join(", ")}`);
  process.exit(1);
}

const entries = Object.entries(settings).filter(([, v]) => v);

if (process.argv.includes("--github-env")) {
  const target = process.env.GITHUB_ENV;
  if (!target)
    throw new Error("GITHUB_ENV isn't set; --github-env is for GitHub Actions");
  // Mask the keys in CI logs, then export them to later steps.
  for (const [key, value] of entries) {
    if (key.endsWith("_KEY")) console.log(`::add-mask::${value}`);
  }
  fs.appendFileSync(
    target,
    entries.map(([k, v]) => `${k}=${v}`).join("\n") + "\n",
  );
  console.log(`Exported ${entries.map(([k]) => k).join(", ")}`);
  process.exit(0);
}

/** Updates (or adds) keys in a .env-style file, keeping everything else. */
function update(file, values) {
  const lines = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split(/\r?\n/)
    : [];
  const done = new Set();
  const next = lines.map((line) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (key && key in values) {
      done.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!done.has(key)) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(file, next.join("\n").replace(/\n*$/, "\n"));
}

const all = Object.fromEntries(entries);
update(".env.local", all);
// Docker Compose reads .env for its own settings.
update(".env", {
  NEXT_PUBLIC_SUPABASE_URL: all.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    all.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: all.SUPABASE_SECRET_KEY,
});
console.log(
  "Wrote Supabase settings to .env.local and .env (neither is committed).",
);
