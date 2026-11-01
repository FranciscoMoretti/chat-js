import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const output = fileURLToPath(
  new URL("../uiverify-screenshots/", import.meta.url)
);
await mkdir(output, { recursive: true });
const origin =
  process.env.CREATE_BASE_URL ??
  `http://localhost:${process.env.PORT ?? "3172"}`;
const base = process.env.CREATE_UI_BASE ?? "base";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    storageState: process.env.CREATE_STORAGE_STATE,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/create?base=${base}&uploads=true`, {
    waitUntil: "domcontentloaded",
  });
  const frame = page.frameLocator("iframe");
  await frame
    .getByRole("heading", { name: "A small start. A great experience." })
    .waitFor();
  await frame
    .getByLabel("Message", { exact: true })
    .fill("An unfinished draft");
  await frame.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(
    frame.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(frame.getByLabel("Message", { exact: true })).toHaveText("");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("item"))
    .toBe("preview");
  await frame.getByLabel("Message", { exact: true }).fill("A local message");
  await frame.getByRole("button", { name: "Send" }).click();
  await frame.getByText("A local message", { exact: true }).waitFor();
  await frame
    .getByLabel("Message", { exact: true })
    .fill("Another unfinished draft");
  await frame.getByRole("button", { name: "Attach sample file" }).click();
  await frame
    .getByRole("button", { name: "Remove sample attachment" })
    .waitFor();
  await frame.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(
    frame.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(frame.getByLabel("Message", { exact: true })).toHaveText("");
  await expect(frame.getByText("A local message", { exact: true })).toHaveCount(
    0
  );
  await expect(
    frame.getByRole("button", { name: "Remove sample attachment" })
  ).toHaveCount(0);
  await page.screenshot({
    path: `${output}${base}-create-sidebar-new-chat.png`,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  assert.deepEqual(errors, [], "No browser runtime errors");
} finally {
  await browser.close();
}
