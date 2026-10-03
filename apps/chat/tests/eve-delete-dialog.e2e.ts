/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

/* oxlint-disable no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("deletion dialog state gallery") uses 20, 1024, 7 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("deletion dialog state gallery") uses execFileSync( "bun", [ "-e", 'const result = await Bun.build({entrypoints:["test; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("deletion dialog state gallery") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("deletion dialog state gallery") accepts { page }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("deletion dialog state gallery") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("deletion dialog state gallery", async ({ page }, testInfo) => {
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({entrypoints:["tests/eve-delete-dialog.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
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
  await page.route("http://eve-delete-dialog.test/", (route) =>
    route.fulfill({
      body: `<!doctype html><html class="dark"><head><style>${css} body{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px} #root{display:contents} [data-slot="dialog-overlay"],[data-radix-focus-guard]{display:none!important} [data-slot="dialog-content"]{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;max-width:none!important;animation:none!important;align-self:start}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
      contentType: "text/html",
    })
  );
  await page.goto("http://eve-delete-dialog.test/");
  await page.addScriptTag({ content: script, type: "module" });
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(7);
  await page.setViewportSize({ height: 1100, width: 1380 });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("deletion-states.png"),
  });
});
/* oxlint-enable no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
