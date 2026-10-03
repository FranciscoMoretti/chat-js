import { expect, test } from "@playwright/test";

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types  --
 * max-statements (#512): test("connector settings hydrate consistently across page boundaries") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("connector settings hydrate consistently across page boundaries") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("connector settings hydrate consistently across page boundaries") accepts { page, }; testInfo; error; message; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("connector settings hydrate consistently across page boundaries", async ({
  page,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  const recordHydrationError = (message: string): void => {
    if (/hydration|server rendered HTML/iu.test(message)) {
      hydrationErrors.push(message);
    }
  };
  page.on("pageerror", (error) => recordHydrationError(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      recordHydrationError(message.text());
    }
  });

  await page.request.get("/api/dev-login", { maxRedirects: 0 });
  await page.goto("/settings/connectors");
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await testInfo.attach("connector-settings-hydrated", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL("/settings/connectors");
  await page.reload();
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/settings/connectors/hydration-regression-missing");
  await expect(
    page.getByText("Connector not found", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Back" }).click();
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */
