/* oxlint-disable import/no-nodejs-modules -- the node:assert/strict import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
import assert from "node:assert/strict";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
import { mkdir } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:url import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { fileURLToPath } from "node:url";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Page } from "playwright";
/* oxlint-enable sort-imports */
import { chromium } from "playwright";

// Run through `bun test:visual:site` with `bun dev:site` already running.
// Frozen time and reduced motion make stream states and captures repeatable.
// oxlint-disable-next-line node/no-top-level-await -- This Bun visual-test executable launches Chromium before creating its ordered browser scenario.
const browser = await chromium.launch();
const output = fileURLToPath(
  new URL("../uiverify-screenshots/", import.meta.url)
);
// oxlint-disable-next-line node/no-top-level-await -- This Bun visual-test executable prepares its screenshot directory before capturing the scenario.
await mkdir(output, { recursive: true });
const errors: string[] = [];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve capture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- capture: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
const capture = async (page: Page, name: string): Promise<void> => {
  await page.getByTestId("thread-playground").screenshot({
    animations: "disabled",
    path: `${output}${name}.png`,
    style:
      "header:has(> nav), nextjs-portal { visibility: hidden !important; }",
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable node/no-process-env -- thread-playground.visual.ts: The scenario explicitly controls process environment inputs and restores them during cleanup. */
/* oxlint-disable eslint/no-magic-numbers -- thread-playground.visual.ts: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
/* oxlint-disable eslint/no-console -- thread-playground.visual.ts: Console output is the observable diagnostic exercised by this fixture. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- thread-playground.visual.ts: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
/* oxlint-disable typescript/promise-function-async -- thread-playground.visual.ts: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
/* oxlint-disable node/no-top-level-await -- This Bun visual-test executable runs one ordered Playwright scenario and awaits browser disposal in finally; it is not a require(esm) library entrypoint. */
try {
  const page = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { height: 1200, width: 1440 },
  });
  page.on("pageerror", (error): number => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto(`http://localhost:${process.env.PORT}/threads`);
  await page.getByTestId("thread-playground").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  const intro = page.locator("main > section").first();
  assert.match(
    (await intro.locator("pre").textContent()) ?? "",
    /useThread\(\)/u
  );
  await intro.screenshot({
    animations: "disabled",
    path: `${output}threads-intro.png`,
  });
  const docsLinks = page.getByRole("link", { name: "Read the docs" });
  assert.equal(await docsLinks.count(), 2);
  const links = await docsLinks.all();
  const hrefs = await Promise.all(
    links.map((link) => link.getAttribute("href"))
  );
  for (const href of hrefs) {
    assert.equal(href, "https://chatjs.dev/docs/threads");
  }
  await docsLinks
    .last()
    .locator("..")
    .screenshot({
      animations: "disabled",
      path: `${output}threads-docs-link.png`,
    });
  const installCommand = page
    .getByRole("button", { name: "Copy installation command" })
    .locator("../..");
  assert.equal(
    await installCommand.locator("code").textContent(),
    "$ bun add @chat-js/thread"
  );
  await installCommand.screenshot({
    animations: "disabled",
    path: `${output}threads-install.png`,
  });
  const initialHeight = await page
    .getByTestId("thread-playground")
    .evaluate((element): number => element.clientHeight);
  assert.equal(
    await page
      .locator("article")
      .filter({ hasText: "You" })
      .first()
      .evaluate((user): boolean => {
        const assistant = user.nextElementSibling;
        return (
          assistant !== null &&
          user.getBoundingClientRect().left >
            assistant.getBoundingClientRect().left + 40
        );
      }),
    true,
    "User bubbles are visibly inset from assistant replies"
  );
  await capture(page, "threads-initial");

  await page.getByRole("button", { name: "Run 3 replies" }).click();
  const monitor = page.locator("aside");
  await page.waitForFunction(
    (): boolean =>
      document.querySelectorAll('[data-node-id][data-state="streaming"]')
        .length === 3
  );
  await page.clock.runFor(1800);
  assert.equal(
    await page
      .getByTestId("thread-playground")
      .evaluate((element): number => element.clientHeight),
    initialHeight,
    "Starting three replies does not shift the map or conversation"
  );
  const first = monitor
    .getByRole("button")
    .filter({ hasText: "Response 1 of 3" });
  const second = monitor
    .getByRole("button")
    .filter({ hasText: "Response 2 of 3" });
  const before = await second.textContent();
  await page.getByRole("button", { name: "Stop selected response" }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-node-id][data-state="stopped"]')
  );
  const stoppedText = await first.textContent();
  await page.clock.runFor(1200);
  assert.match(stoppedText ?? "", /Stopped/u);
  assert.equal(
    await first.textContent(),
    stoppedText,
    "Stopped response stops growing"
  );
  assert.notEqual(
    await second.textContent(),
    before,
    "Other responses keep growing"
  );
  assert.equal(
    await page.locator('[data-node-id][data-state="streaming"]').count(),
    2
  );
  assert.equal(
    await page.getByRole("region", { name: "Response activity" }).count(),
    0
  );
  assert.equal(
    await page.locator("aside").evaluate((panel): boolean => {
      const viewport =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parentElement from panel.querySelector(...).parentElement; read parentElement from panel.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        panel.querySelector("[data-node-id]")?.parentElement?.parentElement;
      if (!viewport) {
        return false;
      }
      const bounds = viewport.getBoundingClientRect();
      return [...panel.querySelectorAll("[data-node-id]")].every(
        (node): boolean => {
          const box = node.getBoundingClientRect();
          return (
            box.left >= bounds.left &&
            box.right <= bounds.right &&
            box.top >= bounds.top &&
            box.bottom <= bounds.bottom
          );
        }
      );
    }),
    true,
    "Every node fits inside the map viewport"
  );
  await capture(page, "threads-live-and-stopped");

  await second.click();
  assert.equal(await second.getAttribute("aria-pressed"), "true");
  assert.match(
    (await page.locator('[data-node-id][aria-pressed="true"]').textContent()) ??
      "",
    /Response 2 of 3/u
  );
  await page.locator('[data-node-id="msg_02"]').click();
  assert.equal(
    await page.locator('[data-node-id="msg_02"]').getAttribute("aria-pressed"),
    "true"
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Stop selected response" })
      .isDisabled(),
    true
  );
  await page.clock.runFor(20_000);
  assert.equal(
    await page.locator('[data-node-id][data-state="streaming"]').count(),
    0
  );
  assert.match((await second.textContent()) ?? "", /Complete/u);
  await second.click();
  await capture(page, "threads-complete");

  // Branch creation must preserve the original branch and select the new reply.
  const originalCount = await page.locator("[data-node-id]").count();
  await page
    .getByRole("button", { exact: true, name: "Branch from here" })
    .last()
    .click();
  await page.waitForFunction(
    (count): boolean =>
      document.querySelectorAll("[data-node-id]").length === count + 2,
    originalCount
  );
  await page.getByRole("button", { name: "Stop all responses" }).click();
  await page.waitForFunction(
    (): boolean =>
      document.querySelectorAll('[data-node-id][data-state="streaming"]')
        .length === 0
  );
  assert.match(
    (await page.locator('[data-node-id][aria-pressed="true"]').textContent()) ??
      "",
    /Branch response/u
  );
  await capture(page, "threads-new-branch");

  await page.getByRole("button", { name: "Reset demo" }).click();
  assert.equal(await page.locator("[data-node-id]").count(), 7);
  await page.getByRole("button", { name: "Run 3 replies" }).click();
  await page.waitForFunction(
    (): boolean =>
      document.querySelectorAll('[data-node-id][data-state="streaming"]')
        .length === 3
  );
  await page.clock.runFor(1800);
  await page.evaluate((): void =>
    document.documentElement.classList.add("dark")
  );
  await capture(page, "threads-dark-live");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate((): void =>
    document.documentElement.classList.remove("dark")
  );
  assert.equal(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth
    ),
    true,
    "No page-level horizontal overflow on mobile"
  );
  const mobileBranch = monitor
    .getByRole("button")
    .filter({ hasText: "Response 3 of 3" });
  await mobileBranch.scrollIntoViewIfNeeded();
  assert.ok(
    await mobileBranch.evaluate(
      (element): boolean => element.getBoundingClientRect().width >= 100
    ),
    "Mobile branch targets remain readable"
  );
  await mobileBranch.click();
  assert.equal(
    await mobileBranch.getAttribute("aria-pressed"),
    "true",
    "Offscreen mobile branches remain reachable"
  );
  await capture(page, "threads-mobile-live");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    `Threads interaction checks passed; deterministic captures in ${output}`
  );
} finally {
  await browser.close();
}
/* oxlint-enable node/no-top-level-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
