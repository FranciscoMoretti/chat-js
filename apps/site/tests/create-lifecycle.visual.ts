/* eslint-disable no-await-in-loop -- Scene transitions are deliberately sequential and repeated. */
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
const output = fileURLToPath(
  new URL("../uiverify-screenshots/", import.meta.url)
);
await mkdir(output, { recursive: true });
const url = `${origin}/create`;
const page = await browser.newPage({
  storageState: process.env.CREATE_STORAGE_STATE,
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
  reducedMotion: "reduce",
});
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});
page.setDefaultTimeout(15_000);
const frame = page.frameLocator("iframe");
const scenes = [
  { label: "New chat", item: "preview", title: "New chat" },
  { label: "Tools", item: "preview-tools", title: "Tool states" },
  { label: "Chat", item: "preview-02", title: "Conversation" },
] as const;
const expectScene = async (scene: (typeof scenes)[number]) => {
  console.log("Checking scene", scene.label, page.url());
  await expect(
    page.getByRole("button", { name: scene.label, exact: true })
  ).toHaveAttribute("data-active", "true");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("item") ?? "preview-02")
    .toBe(scene.item);
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(
    frame.getByRole("button", { name: "Preview scenario" })
  ).toHaveText(scene.title, { timeout: 15_000 });
  await expect(frame.getByTestId("chat-preview")).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Attach sample file" })
  ).toBeVisible();
};
try {
  await page.goto(`${url}?base=${base}&uploads=true`, {
    waitUntil: "domcontentloaded",
  });
  await expectScene(scenes[2]);
  // This was red: the iframe changed scenes while the host URL/selection stayed on Chat.
  await frame.getByRole("button", { name: "Preview scenario" }).click();
  await frame
    .getByRole("menuitemradio", { name: "Tool states", exact: true })
    .click();
  await expectScene(scenes[1]);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectScene(scenes[2]);
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expectScene(scenes[1]);

  await page.getByRole("button", { name: /^Theme /u }).click();
  await page.getByRole("menuitemradio", { name: "Rose", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("preset"))
    .toBe("b4Xa52");
  const preset = new URL(page.url()).searchParams.get("preset");
  assert.notEqual(preset, null, "The selected theme has a native preset code");
  if (preset === null) {
    throw new Error("Missing selected native preset");
  }
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-preset",
    preset
  );
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-mode",
    "dark"
  );
  for (let iteration = 0; iteration < 6; iteration += 1) {
    for (const scene of scenes) {
      await page
        .getByRole("button", { name: scene.label, exact: true })
        .click();
      await expectScene(scene);
      await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
        "data-preset",
        preset
      );
      await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
        "data-mode",
        "dark"
      );
    }
  }
  // Do not wait for intermediate iframe loads: the final request must win.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (const scene of scenes) {
      await page
        .getByRole("button", { name: scene.label, exact: true })
        .click();
    }
  }
  await expectScene(scenes[2]);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-mode",
    "dark"
  );
  await frame.getByRole("button", { name: "Attach sample file" }).click();
  await expect(
    frame.getByRole("button", { name: "Remove sample attachment" })
  ).toBeVisible();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expectScene(scenes[0]);
  await expect(
    frame.getByRole("button", { name: "Remove sample attachment" })
  ).toHaveCount(0);
  await page.screenshot({
    path: `${output}${base}-create-lifecycle-new-chat.png`,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  // Cold URLs and reloads use the same state as host/preview scene changes.
  for (const scene of scenes) {
    await page.goto(
      `${url}?base=${base}&uploads=true&preset=${preset}&item=${scene.item}`,
      {
        waitUntil: "domcontentloaded",
      }
    );
    await expectScene(scene);
    await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
      "data-preset",
      preset
    );
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectScene(scenes[2]);
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-mode",
    "light"
  );
  await frame.getByRole("button", { name: "Preview scenario" }).click();
  await frame
    .getByRole("menuitemradio", { name: "New chat", exact: true })
    .click();
  await expectScene(scenes[0]);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-mode",
    "light"
  );
  await page.screenshot({
    path: `${output}${base}-create-lifecycle-mobile.png`,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  assert.deepEqual(
    errors,
    [],
    "Scene switching emits no browser runtime errors"
  );
  console.log(
    "Scene controls, history, rapid transitions, cold loads, theme and uploads passed."
  );
} finally {
  await browser.close();
}
