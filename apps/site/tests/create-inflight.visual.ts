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
  const navigation = Promise.withResolvers<null>();
  await page.route(
    "**/create/preview?**",
    async (route) => {
      await navigation.promise;
      await route.continue();
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Tools", exact: true }).click();
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
  navigation.resolve(null);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-preset",
    preset
  );
  await expect(
    frame.getByRole("heading", { name: "Tools at work" })
  ).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Attach sample file" })
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "Preset selected during scene navigation reaches the hydrated preview."
  );

  // Changing the base replaces the iframe. Direction selected while that new
  // document is loading must reach both the URL and the rendered composition.
  await page.goto(`${origin}/create?base=radix&rtl=true&uploads=true`, {
    waitUntil: "domcontentloaded",
  });
  await expect(frame.getByTestId("chat-preview")).toBeVisible();
  await expect(frame.locator("html")).toHaveAttribute("dir", "rtl");
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
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await page.getByRole("radio", { name: "Base UI", exact: true }).click();
  await requested.promise;
  await page
    .getByRole("switch", { name: "Right-to-left", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("rtl"))
    .toBeNull();
  remount.resolve(null);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-base",
    "base"
  );
  await expect(frame.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    frame.getByRole("button", { name: "Attach sample file" })
  ).toBeVisible();
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
    path: `${output}create-inflight-base-ltr.png`,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  assert.deepEqual(errors, []);
  console.log(
    "Base and direction selected during iframe replacement reach the rendered preview."
  );
} finally {
  await browser.close();
}
