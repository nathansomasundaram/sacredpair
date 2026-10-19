import { expect, test } from "@playwright/test";
import { createMember, logIn } from "./support/users";

const tabs = ["Discover", "Details", "Together", "Chat", "Profile"];

test("every tab is reachable and marks itself as current", async ({ page }) => {
  const member = await createMember();
  await logIn(page, member.email);

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
