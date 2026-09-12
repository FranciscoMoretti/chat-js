import { expect, test } from "@playwright/test";

test("layout primitives visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/layout-primitives");

  const fixture = page.getByTestId("layout-primitives-fixture");
  await expect(fixture).toBeVisible();
  await expect(fixture).toHaveScreenshot("layout-primitives-closed.png");

  await page.getByRole("button", { name: "Open alert" }).click();
  await expect(page.getByText("Delete project?")).toBeVisible();
  await expect(page).toHaveScreenshot("layout-primitives-alert-open.png");

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByText("Project settings")).toBeVisible();
  await expect(page).toHaveScreenshot("layout-primitives-dialog-open.png");

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByText("Inspector")).toBeVisible();
  await expect(page).toHaveScreenshot("layout-primitives-sheet-open.png");
});
