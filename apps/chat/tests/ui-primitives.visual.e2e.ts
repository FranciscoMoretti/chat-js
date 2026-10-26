import { expect, test } from "@playwright/test";

test("UI primitives visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/ui-primitives");
  await expect(page.getByTestId("ui-primitives-fixture")).toBeVisible();
  // Exercise the native toggle before capture so Playwright cannot mutate the
  // server input's caret style while React is still hydrating this boundary.
  const toggle = page.getByRole("button", { name: "Fixture toggle" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect
    .soft(page.getByTestId("ui-primitives-fixture"))
    .toHaveScreenshot("ui-primitives-closed.png");

  await page.getByRole("button", { name: "Open popover" }).click();
  await expect(page.getByText("Popover content")).toBeVisible();
  await expect
    .soft(page.getByTestId("ui-primitives-fixture"))
    .toHaveScreenshot("ui-primitives-popover-open.png");

  await page.getByRole("button", { name: "Hover tooltip" }).hover();
  await expect(page.getByText("Tooltip content")).toBeVisible();
  await expect
    .soft(page.getByTestId("ui-primitives-fixture"))
    .toHaveScreenshot("ui-primitives-tooltip-open.png");
});
