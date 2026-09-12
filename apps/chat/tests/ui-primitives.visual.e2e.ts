import { expect, test } from "@playwright/test";

test("UI primitives visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/ui-primitives");
  await expect(page.getByTestId("ui-primitives-fixture")).toBeVisible();
  await expect(page).toHaveScreenshot("ui-primitives-closed.png");

  await page.getByRole("button", { name: "Open popover" }).click();
  await expect(page.getByText("Popover content")).toBeVisible();
  await expect(page).toHaveScreenshot("ui-primitives-popover-open.png");

  await page.getByRole("button", { name: "Hover tooltip" }).hover();
  await expect(page.getByText("Tooltip content")).toBeVisible();
  await expect(page).toHaveScreenshot("ui-primitives-tooltip-open.png");
});
