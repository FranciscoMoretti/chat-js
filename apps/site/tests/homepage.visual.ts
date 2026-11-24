import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Page, Locator } from "playwright";
import { readInstallationInput } from "../../../packages/registry/app-preset";
import { siteLinks } from "../lib/site-config";

// Run through bun test:visual:home against the worktree's site dev server.
const url = `http://localhost:${process.env.PORT}/`;
const output = fileURLToPath(
  new URL("../uiverify-screenshots/homepage/", import.meta.url)
);
const openingSizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1725, height: 900 },
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors: string[] = [];

const checkNavigation = async (
  region: Locator,
  size: { width: number; height: number }
) => {
  const mobile = size.width <= 700;
  const menu = region.getByRole("button", { name: "Menu", exact: true });
  const docsLink = region.getByRole("link", { name: "Docs", exact: true });
  if (mobile) {
    assert.equal(await docsLink.count(), 0);
    assert.ok(await region.getByRole("link", { name: "New" }).isVisible());
    await menu.click();
    await docsLink.waitFor();
    if (size.width === 390) {
      await region
        .page()
        .screenshot({ path: `${output}canopy-mobile-menu.png` });
    }
  } else {
    assert.equal(await menu.count(), 0);
  }
  const destinations = await region.getByRole("link").evaluateAll((links) =>
    links.map((link) => ({
      name: (link.getAttribute("aria-label") ?? link.textContent ?? "").trim(),
      href: link.getAttribute("href"),
      x: link.getBoundingClientRect().left,
      right: link.getBoundingClientRect().right,
    }))
  );
  const home = destinations.find((link) => link.name === "ChatJS home");
  const docs = destinations.find((link) => link.name === "Docs");
  const demo = destinations.find((link) => link.name === "Demo");
  const create = destinations.find((link) => link.name === "Create");
  const newApp = destinations.find((link) => /^New\s*\+?$/u.test(link.name));
  assert.ok(docs && demo && create && newApp, JSON.stringify(destinations));
  assert.equal(
    docs.href,
    process.env.NEXT_PUBLIC_CHATJS_DOCS_URL ?? siteLinks.docs
  );
  assert.equal(demo.href, siteLinks.demo);
  assert.equal(create.href, "/create");
  assert.equal(newApp.href, create.href);
  const bounds = await region.getByRole("navigation").boundingBox();
  assert.ok(
    bounds && Math.abs(newApp.right - bounds.x - bounds.width) <= 1,
    "New sits at the far right"
  );
  if (mobile) {
    assert.equal(home, undefined);
    const repo = destinations.find((link) => link.name === "ChatJS on GitHub");
    const menuBounds = await menu.boundingBox();
    assert.ok(repo && menuBounds && Math.abs(menuBounds.x - bounds.x) <= 1);
    assert.equal(repo.href, siteLinks.github);
    assert.ok(
      menuBounds.x + menuBounds.width <= repo.x && repo.right <= newApp.x
    );
    await menu.press("Tab");
    assert.ok(
      await docsLink.evaluate((link) => link === document.activeElement)
    );
    await docsLink.press("Escape");
    assert.equal(await docsLink.count(), 0);
    assert.ok(
      await menu.evaluate((button) => button === document.activeElement)
    );
    await menu.click();
    await region
      .page()
      .getByRole("contentinfo")
      .click({ position: { x: 2, y: 2 } });
    assert.equal(await docsLink.count(), 0);
  } else {
    assert.equal(home?.href, "/");
    assert.ok(
      docs.right <= demo.x &&
        demo.right <= create.x &&
        create.right <= newApp.x,
      "Navigation links must fit side by side"
    );
  }
  assert.ok(destinations.every((link) => link.href !== "/threads"));
};

const inspectOpening = async (page: Page) =>
  await page.evaluate(() => {
    const field = document
      .querySelector("[data-canopy-field]")
      ?.getBoundingClientRect();
    const command = document
      .querySelector(".canopy-command")
      ?.getBoundingClientRect();
    if (!field || !command) {
      throw new Error("Missing Canopy or command");
    }
    const tiles = [
      ...document.querySelectorAll<HTMLElement>("button[data-block-id]"),
    ].map((tile) => ({
      id: tile.dataset.blockId,
      priority: Number(tile.dataset.priority),
      box: tile.getBoundingClientRect(),
    }));
    const bottom = Math.min(innerHeight, field.bottom);
    const visible = tiles.filter(
      ({ box }) =>
        box.bottom > field.top &&
        box.top < bottom &&
        box.right > 0 &&
        box.left < innerWidth
    );
    // Count complete tiles below the quickstart.
    const readable = visible.filter(
      ({ box }) =>
        box.top >= command.bottom &&
        box.bottom <= bottom + 0.5 &&
        box.left >= -0.5 &&
        box.right <= innerWidth + 0.5
    );
    return {
      visible: visible.map((tile) => tile.id),
      readable: readable.map((tile) => tile.priority).toSorted((a, b) => a - b),
      readableIds: readable.map((tile) => tile.id),
    };
  });

const checkOpening = async (
  page: Page,
  size: { width: number; height: number }
) => {
  await page.setViewportSize(size);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator('button[data-priority="1"]').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.addStyleTag({
    content: "nextjs-portal { visibility: hidden !important; }",
  });
  const header = page.getByRole("banner");
  const heading = page.getByRole("heading", { level: 1 });
  const headerBounds = await header.boundingBox();
  const headingBounds = await heading.boundingBox();
  assert.ok(
    headerBounds &&
      headingBounds &&
      headingBounds.y >= headerBounds.y + headerBounds.height &&
      headingBounds.y + headingBounds.height <= size.height,
    "The complete heading should fit below the header on first load"
  );
  const footer = page.getByRole("contentinfo");
  assert.equal(
    await footer
      .getByRole("link", { name: "Francisco", exact: true })
      .getAttribute("href"),
    "https://x.com/franmoretti_"
  );
  if (size.height >= 568) {
    const bounds = await footer.boundingBox();
    assert.ok(
      bounds && Math.abs(bounds.y + bounds.height - size.height) <= 1,
      "The footer should sit at the bottom of the opening viewport"
    );
  }
  await checkNavigation(header, size);
  assert.equal(
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "GitHub", exact: true })
      .getAttribute("href"),
    siteLinks.github
  );
  assert.equal(
    await page.getByRole("contentinfo").getByRole("navigation").count(),
    0
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  );
  const opening = await inspectOpening(page);
  assert.equal(
    new Set(opening.visible).size,
    opening.visible.length,
    "Every visible tile must have a unique capability"
  );
  assert.deepEqual(
    opening.readable.slice(0, 6),
    [1, 2, 3, 4, 5, 6],
    `First six capabilities must fit in the clear area at ${size.width}×${size.height}`
  );
  console.log(
    `${size.width}×${size.height}: ${opening.visible.length} intersecting, ${opening.readable.length} whole below the command, IDs: ${opening.readableIds.join(", ")}`
  );
  await page.screenshot({
    animations: "disabled",
    path: `${output}canopy-${size.width}x${size.height}.png`,
  });
};

const checkBuild = async (page: Page) => {
  const projects = page.locator('button[data-block-id="projects"]');
  const build = page.getByRole("link", { name: "Build your app", exact: true });
  const original = await projects.getAttribute("aria-pressed");
  const initialHref = await build.getAttribute("href");
  await projects.hover();
  await projects.locator(".canopy-tile-preview").waitFor();
  await projects.screenshot({
    animations: "disabled",
    path: `${output}canopy-projects-preview.png`,
  });
  await projects.click();
  const updated = await projects.getAttribute("aria-pressed");
  assert.equal(updated, String(original !== "true"));
  const href = await build.getAttribute("href");
  assert.ok(href !== null && href !== initialHref);
  const app = new URL(href, url).searchParams.get("app");
  assert.ok(app !== null);
  assert.equal(
    readInstallationInput(app).plugins.includes("projects"),
    updated === "true"
  );
  await page.screenshot({
    animations: "disabled",
    path: `${output}canopy-toggle.png`,
  });
  // Drag a tile horizontally. The field should follow the pointer without changing the build.
  const startBox = await projects.boundingBox();
  assert.ok(startBox);
  const startX = startBox.x + startBox.width / 2;
  const startY = startBox.y + startBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 116, startY, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction((previousX) => {
    const tile = document.querySelector('button[data-block-id="projects"]');
    return tile && Math.abs(tile.getBoundingClientRect().x - previousX) > 80;
  }, startBox.x);
  assert.equal(await build.getAttribute("href"), href);
  const panned = await inspectOpening(page);
  assert.equal(new Set(panned.visible).size, panned.visible.length);
  await build.click();
  await page.waitForURL("**/create?**");
  await page.getByRole("tab", { name: "Plugins", exact: true }).first().click();
  assert.equal(
    await page
      .getByRole("switch", { name: "Projects", exact: true })
      .isChecked(),
    updated === "true"
  );
};

try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  for (const size of openingSizes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Inspect each fresh landing before changing the viewport.
    await checkOpening(page, size);
  }
  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await skip.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  const footer = page.getByRole("contentinfo");
  await page.mouse.move(80, 850);
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(
    () =>
      (document.querySelector("footer")?.getBoundingClientRect().bottom ??
        Infinity) <=
      innerHeight + 1
  );
  await footer.screenshot({ path: `${output}canopy-footer.png` });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await checkBuild(page);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
