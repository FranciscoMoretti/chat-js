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
  await page.route(`http://localhost:${process.env.PORT}/`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "referrer-policy": "no-referrer" },
    });
  });
  await page.addInitScript(() => {
    // oxlint-disable-next-line typescript/unbound-method -- Called below with the original dialog receiver.
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function showModal() {
      const titleId = this.getAttribute("aria-labelledby");
      document.documentElement.dataset.dialogTitleAtOpen =
        titleId === null
          ? ""
          : (document.querySelector(`#${CSS.escape(titleId)}`)?.textContent ??
            "");
      original.call(this);
    };
  });
  await page.goto(`http://localhost:${process.env.PORT}/`);
  await page.getByTestId("homepage").waitFor();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  assert.equal(await page.locator(".catalog-grid button").count(), 21);
  const navigation = page.getByRole("navigation", {
    name: "Main",
    exact: true,
  });
  const docs = navigation.getByRole("link", { name: "Docs", exact: true });
  assert.equal(
    await docs.getAttribute("href"),
    process.env.NEXT_PUBLIC_CHATJS_DOCS_URL ?? "https://chatjs.dev/docs"
  );
  assert.equal(
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Thread library" })
      .getAttribute("href"),
    "/threads"
  );
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
  const header = page.locator("header.carbon-nav");
  const desktopHeader = await header.boundingBox();
  assert.equal(desktopHeader?.height, 60);
  await header.screenshot({ path: `${output}desktop-navigation.png` });
  await page.getByRole("link", { name: "ChatJS home" }).first().focus();
  await header.screenshot({ path: `${output}desktop-navigation-focus.png` });
  await page.locator("main").focus();
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
  await page.getByRole("dialog", { name: "Projects", exact: true }).waitFor();
  assert.equal(
    await page.locator("html").getAttribute("data-dialog-title-at-open"),
    "Projects"
  );
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
  await page
    .getByRole("button", { name: "Explore Projects", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Projects", exact: true }).waitFor();
  await page.keyboard.press("Escape");
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
  await page.setViewportSize({ width: 550, height: 1000 });
  await page.locator("#source").scrollIntoViewIfNeeded();
  await source.locator('#scene[viewBox="0 0 600 1160"]').waitFor();
  const sourceSize = await page.locator(".source-illustration").boundingBox();
  assert.ok(
    sourceSize &&
      sourceSize.width < 540 &&
      sourceSize.height / sourceSize.width > 1.9
  );
  assert.equal(
    await source.locator("html").evaluate(() => document.referrer),
    ""
  );
  await page.locator("#source").screenshot({
    path: `${output}narrow-source-complete.png`,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLinks = await Promise.all(
    ["Docs", "Demo", "Create", "GitHub"].map(
      async (name) =>
        await navigation.getByRole("link", { name, exact: true }).isVisible()
    )
  );
  assert.deepEqual(mobileLinks, [true, true, true, true]);
  const mobileHeader = await header.boundingBox();
  assert.equal(mobileHeader?.height, 56);
  await header.screenshot({ path: `${output}mobile-navigation.png` });
  await page
    .getByRole("contentinfo")
    .screenshot({ path: `${output}mobile-footer.png` });
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
