import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright's web-first toHaveURL matcher requires the complete Page receiver; the minimal goto/getByRole projection fails its matcher type.
test("chat page loads", async ({ page }: { readonly page: Readonly<Page> }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("development login tool is available on the login page", async ({
  page,
}: {
  readonly page: Readonly<Pick<Page, "goto" | "getByRole">>;
}) => {
  await page.goto("/login");

  const devLogin = page.getByRole("link", { name: "Dev login" });
  await expect(devLogin).toBeVisible();
  await expect(devLogin).toHaveAttribute("href", "/api/dev-login");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
