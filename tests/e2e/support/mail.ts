import { MAILPIT_URL } from "./env";

type Summary = { ID: string; Subject: string; Created: string };

async function search(email: string): Promise<Summary[]> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  return ((await res.json()).messages ?? []) as Summary[];
}

/** How many emails have been sent to this address. */
export async function countEmails(email: string) {
  return (await search(email)).length;
}

/**
 * Waits for the newest email to `email` whose subject matches, and returns the
 * path of the Sacred Pair link inside it (origin removed, so the test can open
 * it on whatever port the app runs on).
 */
export async function latestEmailLink(
  email: string,
  subject: RegExp,
  { after = 0, timeoutMs = 15_000 } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = (await search(email))
      .filter((m) => subject.test(m.Subject))
      .sort((a, b) => b.Created.localeCompare(a.Created));
    if (messages.length > after) {
      const res = await fetch(
        `${MAILPIT_URL}/api/v1/message/${messages[0].ID}`,
      );
      const html: string = (await res.json()).HTML ?? "";
      const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(html)?.[1];
      if (!href) throw new Error("No /auth/confirm link in the email");
      const url = new URL(href.replaceAll("&amp;", "&"));
      return `${url.pathname}${url.search}`;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${email} matching ${subject} arrived`);
}
