import { expect, test } from "@playwright/test";

test("layout dialogs and sheets open and close", async ({ page }) => {
  await page.goto("/visual-fixtures/layout-primitives");

  const fixture = page.getByTestId("layout-primitives-fixture");
  await expect(fixture).toBeVisible();

  await page.getByRole("button", { name: "Open alert" }).click();
  await expect(page.getByText("Delete project?")).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByText("Project settings")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByText("Inspector")).toBeVisible();
});
