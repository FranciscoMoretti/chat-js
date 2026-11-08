import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Run with the real site already running through bun dev:site.
const browser = await chromium.launch();
const output = fileURLToPath(
  new URL("../uiverify-screenshots/homepage/", import.meta.url)
);
await mkdir(output, { recursive: true });
const errors: string[] = [];
try {
  const page = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1050 },
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.goto(`http://localhost:${process.env.PORT}/`);
  await page.getByTestId("homepage").waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  assert.equal(await page.locator(".catalog-grid button").count(), 21);
  const navigation = page.getByRole("navigation", {
    name: "Main",
    exact: true,
  });
  assert.deepEqual(await navigation.getByRole("link").allTextContents(), [
    "Docs",
    "Demo",
    "Create",
    "",
  ]);
  assert.equal(
    await navigation
      .getByRole("link", { name: "Create", exact: true })
      .getAttribute("href"),
    "/create"
  );
  assert.equal(
    await navigation
      .getByRole("link", { name: "GitHub", exact: true })
      .getAttribute("href"),
    "https://github.com/franciscomoretti/chat-js"
  );
  await page
    .locator("header")
    .screenshot({ path: `${output}desktop-navigation.png` });
  assert.equal(
    await page
      .getByRole("link", { name: "Create your app" })
      .first()
      .getAttribute("href"),
    "/create"
  );
  await page
    .locator(".hero")
    .screenshot({ path: `${output}desktop-hero.png`, animations: "disabled" });
  await page.locator("#blocks").screenshot({
    path: `${output}desktop-collection.png`,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Explore Projects", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .screenshot({ path: `${output}projects-dialog.png` });
  assert.match(
    (await page.getByRole("dialog").textContent()) ?? "",
    /add projects/u
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  assert.equal(
    await page
      .getByRole("button", { name: "Explore Projects", exact: true })
      .evaluate((button) => button === document.activeElement),
    true
  );
  await page.locator("#source").scrollIntoViewIfNeeded();
  const source = page.frameLocator(".source-illustration");
  await source
    .locator("#status")
    .getByText("Your capabilities. Your code.")
    .waitFor();
  await page.locator("#source").screenshot({
    path: `${output}source-complete.png`,
    animations: "disabled",
  });
  await page.locator("#faq details").last().locator("summary").click();
  await page.locator("#faq").screenshot({ path: `${output}faq.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLinks = await Promise.all(
    ["Docs", "Demo", "Create", "GitHub"].map(
      async (name) =>
        await navigation.getByRole("link", { name, exact: true }).isVisible()
    )
  );
  assert.deepEqual(mobileLinks, [true, true, true, true]);
  await page
    .locator("header")
    .screenshot({ path: `${output}mobile-navigation.png` });
  await page
    .locator(".hero")
    .screenshot({ path: `${output}mobile-hero.png`, animations: "disabled" });
  await page.locator("#blocks").screenshot({
    path: `${output}mobile-collection.png`,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
