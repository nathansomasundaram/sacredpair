#!/usr/bin/env node
/**
 * Gives someone access to the moderation area (/admin), or takes it away.
 * They need a Sacred Pair account first.
 *
 *   npm run staff -- add you@example.com admin
 *   npm run staff -- add helper@example.com moderator
 *   npm run staff -- remove helper@example.com
 *   npm run staff -- list
 *
 * Uses SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local, or
 * from the environment (to run it against production, set them there).
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Settings can come from the environment instead.
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (npm run env:local does this locally).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [command, email, role = "moderator"] = process.argv.slice(2);

async function findUser(address) {
  const { data, error } = await admin.rpc("staff_search_members", { p_query: address });
  if (error) throw error;
  return (data ?? []).find((m) => m.email?.toLowerCase() === address.toLowerCase());
}

if (command === "list") {
  const { data, error } = await admin.from("staff").select("user_id, role");
  if (error) throw error;
  for (const s of data) {
    const { data: u } = await admin.auth.admin.getUserById(s.user_id);
    console.log(`${s.role.padEnd(9)} ${u?.user?.email ?? s.user_id}`);
  }
  if (data.length === 0) console.log("No staff yet.");
} else if ((command === "add" || command === "remove") && email) {
  const user = await findUser(email);
  if (!user) {
    console.error(`No account with the email ${email}.`);
    process.exit(1);
  }
  if (command === "add") {
    if (!["admin", "moderator"].includes(role)) {
      console.error('Role must be "admin" or "moderator".');
      process.exit(1);
    }
    const { error } = await admin.from("staff").upsert({ user_id: user.id, role }, { onConflict: "user_id" });
    if (error) throw error;
    console.log(`${email} is now ${role === "admin" ? "an admin" : "a moderator"}. They can open /admin.`);
  } else {
    const { error } = await admin.from("staff").delete().eq("user_id", user.id);
    if (error) throw error;
    console.log(`${email} no longer has moderation access.`);
  }
} else {
  console.log("Usage: npm run staff -- add <email> [admin|moderator] | remove <email> | list");
}
