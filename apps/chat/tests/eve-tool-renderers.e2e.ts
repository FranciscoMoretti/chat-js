/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; import { readFileSync } from "node:fs";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("installed renderer states stay readable at desktop and mobile sizes") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("installed renderer states stay readable at desktop and mobile sizes") uses 0, 2, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("installed renderer states stay readable at desktop and mobile sizes") uses execFileSync("bun", ["tests/eve-renderer-fixture.ts"], { encoding: "utf-8", }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("installed renderer states stay readable at desktop and mobile sizes") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("installed renderer states stay readable at desktop and mobile sizes") accepts { page, }; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("installed renderer states stay readable at desktop and mobile sizes") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("installed renderer states stay readable at desktop and mobile sizes", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  expect(styles.length).toBeGreaterThan(0);
  const content = execFileSync("bun", ["tests/eve-renderer-fixture.ts"], {
    encoding: "utf-8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Counting words...").first()).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-renderer-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("native video renderer covers progress, completion and failure states") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native video renderer covers progress, completion and failure states") uses 3, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("native video renderer covers progress, completion and failure states") uses execFileSync("bun", ["tests/eve-video-renderer-fixture.ts"], { encoding: "utf-8", }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("native video renderer covers progress, completion and failure states") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("native video renderer covers progress, completion and failure states") accepts { page, }; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native video renderer covers progress, completion and failure states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native video renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route("**/api/files/abcdefghijklmnopqrstuvwx.mp4", (route) =>
    route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-video-renderer-fixture.ts"], {
    encoding: "utf-8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText('Generating video: "Preparing prompt…"')
  ).toBeVisible();
  await expect(
    page.getByText('Generating video: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/api/files/abcdefghijklmnopqrstuvwx.mp4"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-video-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("native image renderer covers progress, completion and failure states") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native image renderer covers progress, completion and failure states") uses 3, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("native image renderer covers progress, completion and failure states") uses execFileSync( "bun", ["tests/eve-video-renderer-fixture.ts", "--image"], { encodin within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("native image renderer covers progress, completion and failure states") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("native image renderer covers progress, completion and failure states") accepts { page, }; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native image renderer covers progress, completion and failure states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native image renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route("**/api/files/abcdefghijklmnopqrstuvwx.png", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320"><rect width="512" height="320" fill="white"/><rect x="176" y="80" width="160" height="160" fill="royalblue"/></svg>',
      contentType: "image/svg+xml",
    })
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-video-renderer-fixture.ts", "--image"],
    {
      encoding: "utf-8",
    }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText('Generating image: "Preparing prompt…"')
  ).toBeVisible();
  await expect(
    page.getByText('Generating image: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("img")).toHaveAttribute(
    "src",
    "/api/files/abcdefghijklmnopqrstuvwx.png"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-image-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("native research renderer covers progress, clarification, report and failures") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native research renderer covers progress, clarification, report and failures") uses 3, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("native research renderer covers progress, clarification, report and failures") uses execFileSync( "bun", ["tests/eve-research-renderer-fixture.tsx"], { encoding: "utf-8" within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("native research renderer covers progress, clarification, report and failures") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("native research renderer covers progress, clarification, report and failures") accepts { page, }; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native research renderer covers progress, clarification, report and failures") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native research renderer covers progress, clarification, report and failures", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-research-renderer-fixture.tsx"],
    { encoding: "utf-8" }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText("Which time period should the research cover?")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: 'Created "Research report"' })
  ).toBeVisible();
  await expect(page.getByText("Request declined.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(3);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-research-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("native MCP renderer covers pending, result, denial and errors") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native MCP renderer covers pending, result, denial and errors") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native MCP renderer covers pending, result, denial and errors") uses 2, 0, 6, 5, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("native MCP renderer covers pending, result, denial and errors") uses execFileSync("bun", [ "build", "tests/eve-mcp-renderer-fixture.tsx", "--target=browse; readFileSync(bundlePath, "utf-8") within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("native MCP renderer covers pending, result, denial and errors") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("native MCP renderer covers pending, result, denial and errors") accepts { page, }; testInfo; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native MCP renderer covers pending, result, denial and errors") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native MCP renderer covers pending, result, denial and errors", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const bundlePath = testInfo.outputPath("mcp-fixture.js");
  execFileSync("bun", [
    "build",
    "tests/eve-mcp-renderer-fixture.tsx",
    "--target=browser",
    "--outfile",
    bundlePath,
  ]);
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground"><div id="fixture"></div></body></html>`
  );
  await page.addScriptTag({
    content: readFileSync(bundlePath, "utf-8"),
    type: "module",
  });
  const native = page.locator("#native-mcp");
  await expect(
    native.locator("pre:visible").filter({ hasText: "Hello MCP" }).first()
  ).toBeVisible();
  await expect(
    native.getByText(
      "MCP tool failed. Check the connector in settings and try again."
    )
  ).toHaveCount(2);
  await expect(native.getByText("private connector URL")).toHaveCount(0);
  await expect(native.getByText("Result", { exact: true })).toHaveCount(6);
  await native
    .getByRole("button", { exact: true, name: "echo Completed" })
    .click();
  await expect(native.getByText("Result", { exact: true })).toHaveCount(5);
  await native
    .getByRole("button", { exact: true, name: "echo Completed" })
    .click();
  await expect(native.getByText("Result", { exact: true })).toHaveCount(6);

  for (const value of ["false", "0", "true", "null", '""']) {
    await expect(
      page
        .locator("pre:visible")
        .filter({ hasText: new RegExp(`^${value}$`, "u") })
    ).toHaveCount(2);
  }

  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-mcp-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("public tool projection preserves readable results without approval controls or  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("public tool projection preserves readable results without approval controls or  uses 0, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("public tool projection preserves readable results without approval controls or  uses execFileSync("bun", ["tests/eve-public-tools.fixture.ts"], { encoding: "utf-8", }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("public tool projection preserves readable results without approval controls or  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("public tool projection preserves readable results without approval controls or  accepts { page, }; testInfo; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("public tool projection preserves readable results without approval controls or private envelopes", async ({
  page,
}, testInfo) => {
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-public-tools.fixture.ts"], {
    encoding: "utf-8",
  });
  expect(content).not.toContain("owner-approval-secret");
  expect(content).not.toContain("runtime-private");
  expect(content).not.toContain("costUsd");
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Published note", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Waiting for input.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Request declined.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "This tool result is unavailable in the shared conversation.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toHaveCount(0);
  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("public-tool-states.png"),
  });
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
