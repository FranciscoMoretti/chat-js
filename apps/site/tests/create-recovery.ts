import { expect } from "playwright/test";
import type { Page } from "playwright/test";

// Exercise navigation failure, rather than only a successfully loaded scene.
export const verifyPreviewRecovery = async (page: Page, origin: string) => {
  let failPreview = true;
  await page.route("**/create/preview?*", async (route) => {
    await (failPreview ? route.abort("failed") : route.continue());
  });
  await page.goto(`${origin}/create?item=preview-tools`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("button", { name: "Retry preview" })).toBeVisible(
    {
      timeout: 20_000,
    }
  );
  await page.screenshot({
    path: "apps/site/uiverify-screenshots/create-preview-failed.png",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  failPreview = false;
  await page.getByRole("button", { name: "Retry preview" }).click();
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("button", { name: "Search unavailable Error" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: "Retry preview" })
  ).toBeHidden();
  await page.unroute("**/create/preview?*");
};
