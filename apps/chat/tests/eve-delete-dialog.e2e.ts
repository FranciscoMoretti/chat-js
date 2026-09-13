import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("deletion dialog state gallery", async ({ page }, testInfo) => {
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({entrypoints:["tests/eve-delete-dialog.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from= process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("http://eve-delete-dialog.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html class="dark"><head><style>${css} body{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px} #root{display:contents} [data-slot="dialog-overlay"],[data-radix-focus-guard]{display:none!important} [data-slot="dialog-content"]{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;max-width:none!important;animation:none!important;align-self:start}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
    })
  );
  await page.goto("http://eve-delete-dialog.test/");
  await page.addScriptTag({ content: script, type: "module" });
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(7);
  await page.setViewportSize({ width: 1380, height: 1100 });
  await page.screenshot({
    path: testInfo.outputPath("deletion-states.png"),
    fullPage: true,
    animations: "disabled",
  });
});
