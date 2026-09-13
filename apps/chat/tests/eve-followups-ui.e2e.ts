/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

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
