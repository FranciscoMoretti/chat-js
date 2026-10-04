import { expect, test } from "@playwright/test";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Playwright owns the mutable page fixture. */
test("retired agent links render the unmatched-route page", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  const response = await page.goto("/agent?conversation=retired-conversation");
  // oxlint-disable-next-line eslint/no-magic-numbers -- Assert the HTTP not-found contract.
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
