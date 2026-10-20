import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  connect,
  createProfile,
  deleteMembers,
  introduce,
  reportsBy,
  uniqueCity,
} from "./support/profiles";
import { logIn } from "./support/users";

const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function profile(name: string) {
  const p = await createProfile({
    city: uniqueCity(),
    name: `${name} ${Math.random().toString(36).slice(2, 6)}`,
  });
  created.push(p.id);
  return p;
}

/** A second person, in their own browser. */
async function asOther(browser: Browser, email: string, project: string) {
  const context = await browser.newContext(
    project === "phone"
      ? {
          viewport: { width: 412, height: 915 },
          isMobile: true,
          hasTouch: true,
        }
      : {},
  );
  const page = await context.newPage();
  await logIn(page, email);
  return page;
}

const main = (page: Page) => page.getByRole("main");

test("choosing is private until both choose, then they can chat", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  await introduce(ann.id, ben.id);
  await introduce(ben.id, ann.id);

  await logIn(page, ann.email);
  await page.goto(`/details/${ben.id}`);
  await main(page)
    .getByRole("button", { name: `Choose ${ben.name}` })
    .click();
  await expect(
    main(page).getByText(
      `You chose ${ben.name}. We'll connect you if they choose you too.`,
    ),
  ).toBeVisible();
  await expect(
    main(page).getByRole("button", { name: "Change my mind" }),
  ).toBeVisible();

  // Ben can't tell that Ann chose him.
  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto(`/details/${ann.id}`);
  await expect(
    main(benPage).getByRole("heading", {
      name: `Would you like to meet ${ann.name}?`,
    }),
  ).toBeVisible();
  await expect(main(benPage).getByText(/chose you/)).toHaveCount(0);
  await main(benPage)
    .getByRole("button", { name: `Choose ${ann.name}` })
    .click();
  await expect(
    main(benPage).getByText(`You and ${ann.name} chose each other!`),
  ).toBeVisible();

  await main(benPage).getByRole("link", { name: "Open chat" }).click();
  await expect(benPage).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  await expect(
    main(benPage).getByText(`You and ${ann.name} chose each other. Say hello!`),
  ).toBeVisible();

  // Both see the connection in Details and Chat.
  await page.goto("/details");
  await expect(
    main(page)
      .getByRole("region", { name: "Your connections" })
      .getByText(ben.name),
  ).toBeVisible();
  await page.goto("/chat");
  await expect(
    main(page).getByRole("link", { name: new RegExp(ben.name) }),
  ).toContainText("New connection");
});

test("passing can be undone", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  await introduce(ann.id, ben.id);
  await logIn(page, ann.email);
  await page.goto(`/details/${ben.id}`);
  await main(page).getByRole("button", { name: "Pass" }).click();
  await expect(
    main(page).getByRole("heading", { name: `You passed on ${ben.name}` }),
  ).toBeVisible();
  await main(page)
    .getByRole("button", { name: `Choose ${ben.name} instead` })
    .click();
  await expect(
    main(page).getByRole("heading", { name: `You chose ${ben.name}` }),
  ).toBeVisible();
});

test("messages arrive, unread counts and read receipts update", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);

  await logIn(page, ann.email);
  await page.goto(`/chat/${cid}`);
  const box = main(page).getByRole("textbox", {
    name: `Message to ${ben.name}`,
  });
  await box.fill("Hello Ben, how was your week?");
  await main(page).getByRole("button", { name: "Send" }).click();
  const log = main(page).getByRole("log");
  await expect(log.getByText("Hello Ben, how was your week?")).toBeVisible();
  await expect(log.getByText(/· Sent$/)).toBeVisible();
  await expect(box).toHaveValue("");

  // Ben sees it waiting, unread.
  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto("/chat");
  const row = main(benPage).getByRole("link", { name: new RegExp(ann.name) });
  await expect(row).toContainText("Hello Ben, how was your week?");
  await expect(row).toContainText("1 unread message");
  await expect(benPage.getByRole("navigation").first()).toContainText(
    "1 unread message",
  );

  // Opening it marks it read; his reply reaches Ann without reloading.
  await row.click();
  await expect(
    main(benPage).getByRole("log").getByText("Hello Ben, how was your week?"),
  ).toBeVisible();
  await main(benPage).getByRole("textbox").fill("Great, thanks! Yours?");
  await main(benPage).getByRole("button", { name: "Send" }).click();

  await expect(log.getByText("Great, thanks! Yours?")).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await expect(
    main(page).getByRole("log").getByText("Hello Ben, how was your week?"),
  ).toBeVisible();
  // Ann's message shows Read; Ben's unread badge is gone.
  await expect(benPage.getByRole("navigation").first()).not.toContainText(
    "unread",
  );
  await benPage.goto("/chat");
  await expect(
    main(benPage).getByRole("link", { name: new RegExp(ann.name) }),
  ).not.toContainText("unread");
});

test("the sender sees Read once the message is read", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  await logIn(page, ann.email);
  await page.goto(`/chat/${cid}`);
  await main(page).getByRole("textbox").fill("Are you free Saturday?");
  await main(page).getByRole("button", { name: "Send" }).click();
  await expect(
    main(page)
      .getByRole("log")
      .getByText(/· Sent$/),
  ).toBeVisible();

  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto(`/chat/${cid}`);
  await expect(
    main(benPage).getByRole("log").getByText("Are you free Saturday?"),
  ).toBeVisible();

  await expect(
    main(page)
      .getByRole("log")
      .getByText(/· Read$/),
  ).toBeVisible({ timeout: 15_000 });
});

test("only the two of them can open the conversation", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  const eve = await profile("Eve");
  await logIn(page, eve.email);
  await page.goto(`/chat/${cid}`);
  await expect(main(page).getByText(ben.name)).toHaveCount(0);
  await expect(
    page.getByText(/could not be found|isn't available|404/i).first(),
  ).toBeVisible();
});

test("blocking from the chat closes it for both", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);

  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto(`/chat/${cid}`);
  await expect(main(benPage).getByRole("textbox")).toBeVisible();

  await logIn(page, ann.email);
  await page.goto(`/chat/${cid}`);
  await main(page).getByLabel(`More options for ${ben.name}`).click();
  await main(page).getByRole("link", { name: "Report or block" }).click();
  await expect(
    main(page).getByRole("heading", { name: `Report or block ${ben.name}` }),
  ).toBeVisible();
  await main(page)
    .getByRole("button", { name: `Block ${ben.name}` })
    .click();

  await expect(page).toHaveURL(/\/chat\?notice=blocked$/);
  await expect(
    main(page).getByText("Blocked. You won't see each other again."),
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { name: "No conversations yet" }),
  ).toBeVisible();

  // Ben's open conversation closes on its own.
  await expect(
    main(benPage).getByText("This conversation has ended."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(main(benPage).getByRole("textbox")).toHaveCount(0);
  await benPage.goto(`/details/${ann.id}`);
  await expect(
    main(benPage).getByRole("heading", {
      name: "This profile isn't available",
    }),
  ).toBeVisible();
});

test("reporting reaches the moderation team, with or without blocking", async ({
  page,
}) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  await logIn(page, ann.email);
  await page.goto(`/safety/${ben.id}?c=${cid}`);

  // "Something else" needs details.
  await main(page).getByLabel("Something else").check();
  await main(page).getByLabel(`Also block ${ben.name}`).uncheck();
  await main(page).getByRole("button", { name: "Send report" }).click();
  await expect(main(page).getByText("Tell us what happened.")).toBeVisible();

  await main(page).getByLabel("Harassment or threats").check();
  await main(page)
    .getByLabel("What happened? (optional)")
    .fill("Kept messaging after I said no.");
  await main(page).getByRole("button", { name: "Send report" }).click();
  await expect(page).toHaveURL(/\/chat\?notice=reported$/);
  await expect(main(page).getByText("Thank you for telling us.")).toBeVisible();
  // Not blocked: the conversation is still there.
  await expect(
    main(page).getByRole("link", { name: new RegExp(ben.name) }),
  ).toBeVisible();

  expect(await reportsBy(ann.id)).toEqual([
    {
      reported_id: ben.id,
      reason: "harassment",
      details: "Kept messaging after I said no.",
      connection_id: cid,
    },
  ]);
});

test("ending a connection is final", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  await logIn(page, ann.email);
  await page.goto(`/safety/${ben.id}?c=${cid}`);
  await main(page)
    .getByRole("button", { name: `End connection with ${ben.name}` })
    .click();
  await expect(page).toHaveURL(/\/chat\?notice=ended$/);

  await page.goto(`/chat/${cid}`);
  await expect(
    main(page).getByText("This conversation has ended."),
  ).toBeVisible();
  await page.goto(`/details/${ben.id}`);
  await expect(
    main(page).getByRole("heading", { name: "This connection has ended" }),
  ).toBeVisible();
  await expect(
    main(page).getByRole("button", { name: `Choose ${ben.name}` }),
  ).toHaveCount(0);
});
