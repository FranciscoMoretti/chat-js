import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import type { Page } from "playwright";

// Run through `bun test:visual:site` with `bun dev:site` already running.
// Frozen time and reduced motion make stream states and captures repeatable.
const browser = await chromium.launch();
const output = fileURLToPath(
  new URL("../uiverify-screenshots/", import.meta.url)
);
await mkdir(output, { recursive: true });
const errors: string[] = [];

const capture = async (page: Page, name: string) => {
  await page.getByTestId("thread-playground").screenshot({
    animations: "disabled",
    path: `${output}${name}.png`,
    style:
      "header:has(> nav), nextjs-portal { visibility: hidden !important; }",
  });
};

try {
  const page = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { height: 1200, width: 1440 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
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
  for (const link of await docsLinks.all()) {
    assert.equal(
      await link.getAttribute("href"),
      "https://chatjs.dev/docs/threads"
    );
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
    .evaluate((element) => element.clientHeight);
  assert.equal(
    await page
      .locator("article")
      .filter({ hasText: "You" })
      .first()
      .evaluate((user) => {
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
    () =>
      document.querySelectorAll('[data-node-id][data-state="streaming"]')
        .length === 3
  );
  await page.clock.runFor(1800);
  assert.equal(
    await page
      .getByTestId("thread-playground")
      .evaluate((element) => element.clientHeight),
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
    await page.locator("aside").evaluate((panel) => {
      const viewport =
        panel.querySelector("[data-node-id]")?.parentElement?.parentElement;
      if (!viewport) {
        return false;
      }
      const bounds = viewport.getBoundingClientRect();
      return [...panel.querySelectorAll("[data-node-id]")].every((node) => {
        const box = node.getBoundingClientRect();
        return (
          box.left >= bounds.left &&
          box.right <= bounds.right &&
          box.top >= bounds.top &&
          box.bottom <= bounds.bottom
        );
      });
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
    (count) => document.querySelectorAll("[data-node-id]").length === count + 2,
    originalCount
  );
  await page.getByRole("button", { name: "Stop all responses" }).click();
  await page.waitForFunction(
    () =>
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
    () =>
      document.querySelectorAll('[data-node-id][data-state="streaming"]')
        .length === 3
  );
  await page.clock.runFor(1800);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await capture(page, "threads-dark-live");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
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
      (element) => element.getBoundingClientRect().width >= 100
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
