import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("submitted and streaming have distinct visuals and both permit stopping", async ({
  page,
}, testInfo) => {
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
  await page.addStyleTag({
    content:
      '[data-testid="message-assistant-loading"] { opacity: 1 !important; transform: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("composer-states.png"),
  });
});
