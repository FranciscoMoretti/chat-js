/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 */
import { execFileSync } from "node:child_process";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("submitted and streaming have distinct visuals and both permit stopping") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("submitted and streaming have distinct visuals and both permit stopping") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("submitted and streaming have distinct visuals and both permit stopping") uses 20, 1024, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("submitted and streaming have distinct visuals and both permit stopping") uses execFileSync( "bun", [ "-e", 'const result=await Bun.build({entrypoints:["tests/; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("submitted and streaming have distinct visuals and both permit stopping") accepts { page, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("submitted and streaming have distinct visuals and both permit stopping") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("submitted and streaming have distinct visuals and both permit stopping", async ({
  page,
}) => {
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result=await Bun.build({entrypoints:["tests/eve-composer-states.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("http://composer.test/", (route) =>
    route.fulfill({
      body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
      contentType: "text/html",
    })
  );
  await page.goto("http://composer.test/");
  await page.addScriptTag({ content: script, type: "module" });
  const submitted = page.getByRole("region", {
    exact: true,
    name: "Submitted",
  });
  const streaming = page.getByRole("region", {
    exact: true,
    name: "Streaming",
  });
  await expect(submitted.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(submitted.locator("svg.animate-spin")).toBeVisible();
  await expect(
    submitted.getByTestId("message-assistant-loading")
  ).toBeVisible();
  const waiting = page.getByRole("region", {
    exact: true,
    name: "Waiting for content",
  });
  const waitingDot = waiting.getByTestId("message-assistant-loading");
  await expect(waitingDot).toBeVisible();
  await expect(waitingDot).toHaveCSS("opacity", "1");
  await expect(waitingDot.locator("div")).toHaveCSS(
    "animation-name",
    "pulse-dot"
  );
  await expect(
    page
      .getByRole("region", { exact: true, name: "Reasoning" })
      .getByTestId("message-assistant-loading")
  ).toHaveCount(0);
  await expect(streaming.locator("svg.lucide-square")).toBeVisible();
  await expect(streaming.getByTestId("message-assistant-loading")).toHaveCount(
    0
  );
  await expect(
    page
      .getByRole("region", { exact: true, name: "Creating" })
      .getByRole("button", { name: "Send" })
  ).toBeDisabled();
  await expect(
    page
      .getByRole("region", { exact: true, name: "Resuming" })
      .getByRole("button", { name: "Stop" })
  ).toBeDisabled();
  await submitted.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("output")).toHaveText("Submitted");
  await streaming.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("output")).toHaveText("Streaming");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(waitingDot.locator("div")).toHaveCSS("animation-name", "none");
  await expect(waitingDot).toBeVisible();
  await page.addStyleTag({
    content:
      '[data-testid="message-assistant-loading"] { opacity: 1 !important; transform: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await expect(page).toHaveScreenshot("composer-states.png", {
    animations: "disabled",
    fullPage: true,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
