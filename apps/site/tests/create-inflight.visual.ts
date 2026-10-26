import assert from "node:assert/strict";
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
} finally {
  await browser.close();
}
