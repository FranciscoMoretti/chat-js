import { expect, test } from "@playwright/test";

test("composer addons preserve focus and nested button actions", async ({
  page,
}) => {
  await page.goto("/visual-fixtures/lint-controls");
  const fixture = page.getByTestId("lint-controls-fixture");
  const message = page.getByRole("textbox", { name: "Message" });
  await page.getByText("Focus message", { exact: true }).click();
  await expect(message).toBeFocused();
  await message.fill("Keyboard-accessible composer");
  const action = page.getByRole("button", { name: "Attachment action" });
  await action.click();
  await expect(action).toBeFocused();
  await expect(page.getByText("Actions: 1", { exact: true })).toBeVisible();
  await action.press("Enter");
  await expect(page.getByText("Actions: 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Saving" })).toBeVisible();
  await page.getByRole("button", { name: "Change shimmer element" }).click();
  await expect(
    fixture.locator("p").filter({ hasText: "Thinking..." })
  ).toBeVisible();
  await test.info().attach("lint-controls", {
    body: await fixture.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});
