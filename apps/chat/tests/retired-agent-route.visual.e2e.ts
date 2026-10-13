import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

test("retired agent links render the unmatched-route page", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.emulateMedia({ colorScheme: "light" });
  const response = await page.goto("/agent?conversation=retired-conversation");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/agent\?conversation=retired-conversation$/u);
  await expect(
    page.getByRole("heading", { exact: true, name: "404" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Page Not Found" })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("retired-agent-route.png"),
  });
});
