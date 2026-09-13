import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

// Dense state gallery uses the real application CSS and components, without a server or database.
test("response cards preserve layout and select native candidates on desktop and mobile", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({entrypoints:["tests/eve-response-cards.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
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
  await page.route("http://eve-cards.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
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
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.screenshot({
    path: testInfo.outputPath("response-cards-desktop.png"),
    animations: "disabled",
    fullPage: true,
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
    name: "Waiting candidate Waiting",
    exact: true,
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("response-cards-mobile.png"),
    animations: "disabled",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
