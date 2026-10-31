import { expect, test } from "@playwright/test";

test("UI toggles, popovers and tooltips respond to interaction", async ({
  page,
}) => {
  await page.goto("/visual-fixtures/ui-primitives");
  await expect(page.getByTestId("ui-primitives-fixture")).toBeVisible();
  const toggle = page.getByRole("button", { name: "Fixture toggle" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Open popover" }).click();
  await expect(page.getByText("Popover content")).toBeVisible();

  await page.getByRole("button", { name: "Hover tooltip" }).hover();
  await expect(page.getByText("Tooltip content")).toBeVisible();
});
