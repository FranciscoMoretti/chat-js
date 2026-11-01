import { expect, test } from "@playwright/test";

const activations = ["click", "keyboard", "electron"];
const devLoginUrl = /\/api\/dev-login(?:\?.*)?$/u;

for (const activation of activations) {
  test(`dev login performs a document GET and cookie redirect (${activation})`, async ({
    page,
    context,
  }) => {
    if (activation === "electron") {
      await page.addInitScript(() => {
        // The Electron preload exposes this bridge in the renderer.
        window.requestAuth = () => {
          throw new Error("Dev login must not launch the external auth flow");
        };
      });
    }
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({ body: "null", contentType: "application/json" });
    });
    await page.goto("/login");
    await page.addStyleTag({ path: "tests/visual-capture.css" });
    const login = page.getByRole("link", { name: "Dev login" });
    await expect(login).toBeVisible();
    // Wait for hydration; an unhydrated Next Link also behaves as an anchor.
    await expect
      .poll(
        async () =>
          await page
            .getByRole("link", { name: "Back", exact: true })
            .evaluate((element) =>
              Object.keys(element).some((key) =>
                key.startsWith("__reactProps$")
              )
            )
      )
      .toBe(true);
    if (activation === "electron") {
      await expect(
        page.getByText("Continue in browser", { exact: true }).first()
      ).toBeVisible();
    }
    // The route's cookie signing and development-only guard are covered by
    // app/api/dev-login/route.test.ts. Isolate the browser navigation contract
    // here without creating a real development session.
    await page.route(devLoginUrl, async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          location: "/",
          "set-cookie":
            "dev-navigation=session; Path=/; HttpOnly; SameSite=Lax",
        },
      });
    });
    const requestPromise = page.waitForRequest(devLoginUrl);
    if (activation === "keyboard") {
      await login.focus();
      await login.press("Enter");
    } else {
      await login.click();
    }
    const request = await requestPromise;
    expect(request.method()).toBe("GET");
    expect(request.isNavigationRequest()).toBe(true);
    expect(request.resourceType()).toBe("document");
    expect(request.headers().rsc).toBeUndefined();
    await expect(page).toHaveURL("/");
    await page.waitForLoadState("domcontentloaded");
    expect(await context.cookies()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "dev-navigation",
          value: "session",
          httpOnly: true,
          sameSite: "Lax",
        }),
      ])
    );
    const redirect = await request.response();
    const destination = request.redirectedTo();
    expect(redirect?.status()).toBe(302);
    expect(destination?.isNavigationRequest()).toBe(true);
    expect(destination?.headers().cookie).toContain("dev-navigation=session");
  });
}
