/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("shared follow-up controls are actionable, bounded and safe when unavailable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("shared follow-up controls are actionable, bounded and safe when unavailable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("shared follow-up controls are actionable, bounded and safe when unavailable") uses 40, 1024, 20, 0, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("shared follow-up controls are actionable, bounded and safe when unavailable") uses execFileSync( "bun", ["tests/eve-comparison-ui.build.mjs", "tests/eve-followups-ui.fi; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("shared follow-up controls are actionable, bounded and safe when unavailable") accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("shared follow-up controls are actionable, bounded and safe when unavailable") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("shared follow-up controls are actionable, bounded and safe when unavailable", async ({
  page,
}, testInfo) => {
  const script = execFileSync(
    "bun",
    ["tests/eve-comparison-ui.build.mjs", "tests/eve-followups-ui.fixture.tsx"],
    { encoding: "utf-8", maxBuffer: 40 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";process.stdout.write((await postcss([tailwind()]).process(await Bun.file(from).text(),{from})).css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("https://eve-followups.test/**", (route) => {
    if (new URL(route.request().url()).pathname === "/fixture.js") {
      return route.fulfill({ body: script, contentType: "text/javascript" });
    }
    return route.fulfill({
      body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`,
      contentType: "text/html",
    });
  });
  await page.goto("https://eve-followups.test/");
  const completed = page.getByRole("region", { name: "Completed answer" });
  await completed
    .getByRole("button", { exact: true, name: "Can you give an example?" })
    .click();
  await expect(page.getByLabel("Selected suggestion")).toHaveText(
    "Can you give an example?"
  );
  const pending = page.getByRole("region", { name: "Pending request" });
  for (const button of await pending.getByRole("button").all()) {
    await expect(button).toBeDisabled();
  }
  await expect(
    page
      .getByRole("region", { name: "Unavailable suggestions" })
      .getByRole("button")
  ).toHaveCount(0);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 600, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`followups-${width}.png`),
    });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
