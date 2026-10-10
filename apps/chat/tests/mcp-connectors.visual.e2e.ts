import { expect, test } from "@playwright/test";
import type { ConsoleMessage } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --
 * max-statements (#512): test("connector settings hydrate consistently across page boundaries") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.on(), page.goto(), page.keyboard() on the original Page/locator receiver to change the live browser or route state.
test("connector settings hydrate consistently across page boundaries", async ({
  page,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright TestInfo callback calls testInfo.attach() to update the native test runner timeout/attachment state.
}, testInfo) => {
  const hydrationErrors: string[] = [];
  const recordHydrationError = (message: string): void => {
    if (/hydration|server rendered HTML/iu.test(message)) {
      hydrationErrors.push(message);
    }
  };
  page.on("pageerror", (error: Readonly<Error>) =>
    recordHydrationError(error.message)
  );
  page.on(
    "console",
    (message: Readonly<Pick<ConsoleMessage, "type" | "text">>) => {
      if (message.type() === "error") {
        recordHydrationError(message.text());
      }
    }
  );

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
