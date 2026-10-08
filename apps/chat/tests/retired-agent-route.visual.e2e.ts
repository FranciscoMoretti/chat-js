import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { TestInfo } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.emulateMedia(), page.goto() on the original Page/locator receiver to change the live browser or route state.
test("retired agent links render the unmatched-route page", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.emulateMedia({ colorScheme: "light" });
  const response = await page.goto("/agent?conversation=retired-conversation");
  // oxlint-disable-next-line eslint/no-magic-numbers, oxc/no-optional-chaining -- Assert the HTTP not-found contract. Optional chain: Keep the existing nullish guard when reading status from response; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
