#!/usr/bin/env node
/**
 * Creates the key pair for web push notifications and adds it to .env.local
 * (skipped if keys are already there). For Vercel, copy the same two values
 * into the project's environment variables:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (can be public)
 *   VAPID_PRIVATE_KEY             (secret: never commit it)
 * Keep the same pair once you're live: changing it stops existing devices
 * from receiving notifications until they turn push on again.
 */
import fs from "node:fs";
import webpush from "web-push";

const file = ".env.local";
const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (/^VAPID_PRIVATE_KEY=.+/m.test(current)) {
  console.log("Push keys are already in .env.local.");
  process.exit(0);
}
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
fs.writeFileSync(
  file,
  current.replace(/\n*$/, "\n") +
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`,
);
console.log("Added push keys to .env.local. Restart the app to use them.");
