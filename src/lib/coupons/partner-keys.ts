import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * A partner's API key. It's shown once when the partner is made; only its
 * SHA-256 is kept, so a database leak doesn't hand out working keys. The key
 * is long and random, so a fast hash is enough.
 */
export function newPartnerKey(): { key: string; hash: string } {
  const key = `spk_${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashPartnerKey(key) };
}

export function hashPartnerKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** The key from an "Authorization: Bearer ..." header, if it looks like one. */
export function bearerKey(header: string | null): string | null {
  const m = /^Bearer (spk_[A-Za-z0-9_-]{20,100})$/.exec(header ?? "");
  return m ? m[1] : null;
}
