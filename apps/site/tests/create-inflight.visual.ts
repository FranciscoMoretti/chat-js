import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const origin =
  process.env.CREATE_BASE_URL ??
  `http://localhost:${process.env.PORT ?? "3172"}`;
const base = process.env.CREATE_UI_BASE ?? "base";
const browser = await chromium.launch();
const page = await browser.newPage({
  storageState: process.env.CREATE_STORAGE_STATE,
  viewport: { width: 1440, height: 1000 },
});
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});
try {
  await page.goto(`${origin}/create?base=${base}&uploads=true`, {
    waitUntil: "domcontentloaded",
  });
  const frame = page.frameLocator("iframe");
  await expect(frame.getByTestId("chat-preview")).toBeVisible();
  const originalFrame = await frame.locator("body").elementHandle();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: /^Theme /u }).click();
  await page.getByRole("menuitemradio", { name: "Rose", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("preset"))
    .toBe("b4Xa52");
  const preset = new URL(page.url()).searchParams.get("preset");
  if (preset === null) {
    throw new Error("The selected theme has no native preset code");
  }
  assert.equal(
    await originalFrame?.evaluate((element) => element.isConnected),
    true,
    "Scene and preset changes retain the iframe document"
  );
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-preset",
    preset
  );
  await expect(
    frame.getByRole("navigation", { name: "breadcrumb" })
  ).toBeVisible();
  await expect(frame.locator('input[type="file"]')).toBeAttached();
  assert.deepEqual(errors, []);
  console.log(
    "Preset selected during scene navigation reaches the hydrated preview."
  );

  // Recovering an unsupported library creates a fresh iframe. Installation
  // and appearance choices made during that load must reach their destinations.
  await page.goto(`${origin}/create?base=aria&rtl=true&uploads=true`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Use Base UI and Next.js" })
  ).toBeVisible();
  const remount = Promise.withResolvers<null>();
  const requested = Promise.withResolvers<null>();
  await page.route(
    "**/create/preview?**",
    async (route) => {
      requested.resolve(null);
      await remount.promise;
      await route.continue();
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Use Base UI and Next.js" }).click();
  await requested.promise;
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Radix UI", exact: true }).click();
  await page.getByRole("switch", { name: "Use pointer on buttons" }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("base"))
    .toBe("radix");
  remount.resolve(null);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-base",
    "base"
  );
  await expect(frame.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(frame.locator('input[type="file"]')).toBeAttached();
  await expect(page.getByRole("button", { name: "Retry preview" })).toHaveCount(
    0
  );
  await expect(page.getByText("Loading preview…", { exact: true })).toHaveCount(
    0
  );
  const output = fileURLToPath(
    new URL("../uiverify-screenshots/", import.meta.url)
  );
  await mkdir(output, { recursive: true });
  await page.screenshot({
    path: `${output}create-inflight-base-rtl.png`,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  assert.deepEqual(errors, []);
  console.log(
    "Installation library and preview appearance survive an in-flight iframe load."
  );
} finally {
  await browser.close();
}
