import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  connect,
  createProfile,
  deleteMembers,
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

type Q =
  | { type: "choice"; options: string[]; answer: number }
  | { type: "truefalse"; answer: boolean }
  | { type: "order"; items: string[] }
  | { type: "match"; pairs: [string, string][] };

const level = (
  slug: string,
  n: number,
): { title: string; talk: string; questions: Q[] } =>
  JSON.parse(
    fs.readFileSync(`content/journey/en-US/${slug}/level-${n}.json`, "utf8"),
  );

/** Answers the question on screen, right or wrong. */
async function answer(page: Page, q: Q, right = true) {
  const m = main(page);
  if (q.type === "choice") {
    const pick = right ? q.answer : (q.answer + 1) % q.options.length;
    await m.getByRole("radio", { name: q.options[pick], exact: true }).click();
    await m.getByRole("button", { name: "Check" }).click();
  } else if (q.type === "truefalse") {
    await m
      .getByRole("radio", {
        name: (right ? q.answer : !q.answer) ? "True" : "False",
      })
      .click();
    await m.getByRole("button", { name: "Check" }).click();
  } else if (q.type === "order") {
    const items = right
      ? q.items
      : [q.items[1], q.items[0], ...q.items.slice(2)];
    for (const item of items) {
      await m
        .getByRole("list", { name: "Steps to place" })
        .getByRole("button", { name: item, exact: true })
        .click();
    }
    await m.getByRole("button", { name: "Check" }).click();
  } else {
    for (const [i, [a, b]] of q.pairs.entries()) {
      await m
        .getByRole("list", { name: "Items" })
        .getByRole("button", { name: a, exact: true })
        .click();
      if (!right && i === 0) {
        // One wrong match first.
        await m
          .getByRole("list", { name: "Matches" })
          .getByRole("button", { name: q.pairs[1][1], exact: true })
          .click();
        await m
          .getByRole("list", { name: "Items" })
          .getByRole("button", { name: a, exact: true })
          .click();
      }
      await m
        .getByRole("list", { name: "Matches" })
        .getByRole("button", { name: b, exact: true })
        .click();
    }
  }
}

/** Plays a whole level; `miss` lists questions (by index) to get wrong once. */
async function playLevel(
  page: Page,
  slug: string,
  n: number,
  miss: number[] = [],
) {
  const content = level(slug, n);
  await expect(
    main(page).getByRole("heading", { name: content.title }),
  ).toBeVisible();
  await main(page).getByRole("button", { name: "Begin" }).click();
  const queue = content.questions.map((_, i) => i).concat(miss);
  for (const [step, i] of queue.entries()) {
    const right = !(miss.includes(i) && step < content.questions.length);
    await answer(page, content.questions[i], right);
    await expect(main(page).getByRole("status").first()).toContainText(
      right ? "That's right!" : "Not quite",
    );
    await main(page).getByRole("button", { name: "Continue" }).click();
  }
  await expect(main(page).getByText(`Level ${n} done`)).toBeVisible();
  return content;
}

test("a couple chooses a path and moves through it together", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);

  // Ann suggests a path.
  await logIn(page, ann.email);
  await page.goto("/together");
  await main(page)
    .getByRole("link", { name: new RegExp(ben.name) })
    .click();
  await expect(
    main(page).getByRole("heading", { name: "Choose a path together" }),
  ).toBeVisible();
  await main(page).getByRole("button", { name: "Suggest Grow a tree" }).click();
  await expect(
    main(page).getByText(`Your journey starts when ${ben.name} accepts.`),
  ).toBeVisible();

  // Ben accepts.
  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto("/together");
  await expect(
    main(benPage).getByRole("link", { name: new RegExp(ann.name) }),
  ).toContainText(`${ann.name} suggested Grow a tree`);
  await benPage.goto(`/together/${cid}`);
  await main(benPage)
    .getByRole("button", { name: "Start Grow a tree" })
    .click();
  await expect(
    main(benPage).getByText("Your journey has begun."),
  ).toBeVisible();

  // Ann plays level 1, missing one question; it comes back at the end.
  await page.goto(`/together/${cid}`);
  await main(page)
    .getByRole("link", { name: /Level 1: The Seed/ })
    .click();
  const content = await playLevel(page, "grow-a-tree", 1, [0]);
  await expect(
    main(page).getByRole("heading", { name: "3 of 4 right the first time" }),
  ).toBeVisible();
  await expect(
    main(page).getByText(
      `When ${ben.name} finishes this level too, you'll reach: Seed`,
    ),
  ).toBeVisible();
  await expect(main(page).getByText(content.talk)).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Talk in Chat" }),
  ).toHaveAttribute("href", `/chat/${cid}`);

  // She's now one ahead, so level 2 waits for Ben.
  await main(page).getByRole("link", { name: "Back to your journey" }).click();
  await expect(
    main(page).getByText(`You're one level ahead. ${ben.name} is on level 1.`),
  ).toBeVisible();
  await expect(
    main(page).getByText(`Waiting for ${ben.name} to catch up`),
  ).toBeVisible();
  await page.goto(`/together/${cid}/level/2`);
  await expect(page).toHaveURL(new RegExp(`/together/${cid}$`));

  // Ben plays level 1: the tree grows for both.
  await benPage.goto(`/together/${cid}`);
  await expect(
    main(benPage).getByText(`${ann.name} finished this. Your turn!`),
  ).toBeVisible();
  await main(benPage)
    .getByRole("link", { name: /Level 1: The Seed/ })
    .click();
  await playLevel(benPage, "grow-a-tree", 1);
  await expect(
    main(benPage).getByRole("heading", { name: "4 of 4 right the first time" }),
  ).toBeVisible();
  await expect(
    main(benPage).getByText(
      "You both finished this level. Together you've reached: Seed",
    ),
  ).toBeVisible();

  await page.reload();
  await expect(
    main(page).getByText("1 of 9 levels finished together"),
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: /Level 2: Water and Warmth/ }),
  ).toBeVisible();
  await page.goto("/together");
  await expect(
    main(page).getByRole("link", { name: new RegExp(ben.name) }),
  ).toContainText("Grow a tree: 1 of 9 levels together");
});

test("a suggestion can be turned into a different path, and a path left", async ({
  page,
  browser,
}, info) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  await logIn(page, ann.email);
  await page.goto(`/together/${cid}`);
  await main(page)
    .getByRole("button", { name: "Suggest Write a book" })
    .click();
  await expect(
    main(page).getByText(`Your journey starts when ${ben.name} accepts.`),
  ).toBeVisible();

  const benPage = await asOther(browser, ben.email, info.project.name);
  await benPage.goto(`/together/${cid}`);
  await expect(
    main(benPage).getByRole("heading", {
      name: `${ann.name} suggested Write a book`,
    }),
  ).toBeVisible();
  await main(benPage)
    .getByRole("button", { name: "Suggest a different path" })
    .click();
  await main(benPage)
    .getByRole("button", { name: "Suggest Build a house" })
    .click();
  await expect(
    main(benPage).getByText(`Your journey starts when ${ann.name} accepts.`),
  ).toBeVisible();

  await page.reload();
  await main(page).getByRole("button", { name: "Start Build a house" }).click();
  await expect(
    main(page).getByRole("link", {
      name: /Level 1: Planning, Design & Permits/,
    }),
  ).toBeVisible();

  await main(page).getByText("Leave this path").click();
  await main(page).getByRole("button", { name: "Leave Build a house" }).click();
  await expect(main(page).getByText("You've left that path.")).toBeVisible();
  await expect(
    main(page).getByRole("heading", { name: "Choose a path together" }),
  ).toBeVisible();
});

test("only the couple can see their journey", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  const eve = await profile("Eve");
  await logIn(page, eve.email);
  await page.goto(`/together/${cid}`);
  await expect(main(page).getByText(ann.name)).toHaveCount(0);
  await expect(
    page.getByText(/could not be found|isn't available|404/i).first(),
  ).toBeVisible();
});
