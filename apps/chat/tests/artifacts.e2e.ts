import { expect, test } from "@playwright/test";

test("chat page loads for artifacts session", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
