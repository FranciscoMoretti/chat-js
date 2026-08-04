import { expect, test } from "@uiverify/playwright";

/**
 * Visual captures for Blume docs after the 1.3 upgrade.
 * Archives land in uiverify-archive/; upload with:
 *   bunx uiverify upload --static-dir uiverify-archive
 */
const pages = [
  { name: "home", path: "/docs" },
  { name: "quickstart", path: "/docs/quickstart" },
  { name: "changelog", path: "/docs/changelog" },
  { name: "cookbook", path: "/docs/cookbook" },
  { name: "features", path: "/docs/features/overview" },
] as const;

for (const pageDef of pages) {
  test(`docs ${pageDef.name}`, async ({ page, uiVerify }) => {
    await page.clock.setFixedTime(new Date("2026-08-04T12:00:00Z"));
    await page.goto(pageDef.path, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Load lazy content so resource bytes land in the archive
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      scrollTo(0, 0);
    });

    await uiVerify.snapshot(pageDef.name);
  });
}
