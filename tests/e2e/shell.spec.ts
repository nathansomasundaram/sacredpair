import { expect, test } from "@playwright/test";

const tabs = ["Discover", "Details", "Together", "Chat", "Profile"];

test("health check responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("front door leads into the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Open the app" }).click();
  await expect(page).toHaveURL(/\/discover$/);
});

test("every tab is reachable and marks itself as current", async ({ page }) => {
  await page.goto("/discover");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  for (const name of tabs) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(nav.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});
