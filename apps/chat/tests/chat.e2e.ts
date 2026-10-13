import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test("chat page loads", async ({ page }: { readonly page: Readonly<Page> }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});

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
