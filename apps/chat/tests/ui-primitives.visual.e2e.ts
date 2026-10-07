import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): test("UI primitives visual fixture") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("UI primitives visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/ui-primitives");
  await expect(page.getByTestId("ui-primitives-fixture")).toBeVisible();
  await expect(page.getByTestId("ui-primitives-fixture")).toHaveScreenshot(
    "ui-primitives-closed.png"
  );

  await page.getByRole("button", { name: "Open popover" }).click();
  await expect(page.getByText("Popover content")).toBeVisible();
  await expect(page.getByTestId("ui-primitives-fixture")).toHaveScreenshot(
    "ui-primitives-popover-open.png"
  );

  await page.getByRole("button", { name: "Hover tooltip" }).hover();
  await expect(page.getByText("Tooltip content")).toBeVisible();
  await expect(page.getByTestId("ui-primitives-fixture")).toHaveScreenshot(
    "ui-primitives-tooltip-open.png"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
