/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 */

import { execFileSync } from "node:child_process";

// oxlint-disable-next-line sort-imports -- Keep the type-only browser declarations beside their module and preserve runtime import order.
import type { Page, Route, TestInfo } from "@playwright/test";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/promise-function-async --
 * max-lines-per-function (#510): test("response cards preserve layout and select native candidates on desktop and mobi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("response cards preserve layout and select native candidates on desktop and mobi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("response cards preserve layout and select native candidates on desktop and mobi uses 20, 1024, 11, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("response cards preserve layout and select native candidates on desktop and mobi uses execFileSync( "bun", [ "-e", 'const result = await Bun.build({entrypoints:["test; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/promise-function-async (#606): test("response cards preserve layout and select native candidates on desktop and mobi preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// Dense state gallery uses the real application CSS and components, without a server or database.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright fixture supplies the original Page; this test uses route(), goto(), setViewportSize(), keyboard(), and screenshot() to control live browser state.
test("response cards preserve layout and select native candidates on desktop and mobile", async ({
  page,
}: { page: Page }, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  const errors: string[] = [];
  page.on("pageerror", (error: Readonly<Error>) => errors.push(error.message));
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({entrypoints:["tests/eve-response-cards.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from= process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route(
    "http://eve-cards.test/",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() on the original intercepted request to supply the fixture document.
    (route: Route) =>
      route.fulfill({
        body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
        contentType: "text/html",
      })
  );
  await page.goto("http://eve-cards.test/");
  await page.addScriptTag({ content: script, type: "module" });
  const cards = page.getByRole("region", { name: "Eve response states" });
  await expect(cards.getByRole("button")).toHaveCount(11);
  await expect(cards.getByRole("button").first()).toHaveText("GPT-5Selected");
  await expect(
    cards.getByRole("button", { name: "Unknown status Open response" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Single candidate" }).getByRole("button")
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Empty candidates" }).getByRole("button")
  ).toHaveCount(0);
  await expect(
    cards.getByRole("button", { name: "Approval candidate Needs input" })
  ).toBeVisible();
  await page.setViewportSize({ height: 760, width: 1100 });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("response-cards-desktop.png"),
  });
  const retry = cards.getByRole("button", {
    name: "Retry candidate Needs retry",
  });
  await retry.click();
  await expect(retry).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText(
    "Selected operation: unresolved"
  );
  await expect(cards.getByRole("button").first()).toHaveText(
    "GPT-5Task completed"
  );
  const waiting = cards.getByRole("button", {
    exact: true,
    name: "Waiting candidate Waiting",
  });
  await waiting.focus();
  await page.keyboard.press("Enter");
  await expect(waiting).toHaveAttribute("aria-pressed", "true");
  await cards
    .getByRole("button", { name: "Rejected candidate Failed" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Selected operation: rejected"
  );
  await expect(
    cards.getByRole("button", { name: "Disabled candidate Waiting" })
  ).toBeDisabled();
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("response-cards-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/promise-function-async */
