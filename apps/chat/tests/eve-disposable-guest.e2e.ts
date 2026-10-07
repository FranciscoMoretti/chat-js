import { expect, test } from "@playwright/test";
import { z } from "zod";

const bindingSchema = z.object({
  credential: z.string(),
  sessionId: z.string(),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("anonymous chat stays disposable and disappears on reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("anonymous chat stays disposable and disappears on reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("anonymous chat stays disposable and disappears on reload") uses 120_000, 0, 200, 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("anonymous chat stays disposable and disappears on reload") accepts { page, }; testInfo; route; request; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("anonymous chat stays disposable and disappears on reload") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("anonymous chat stays disposable and disappears on reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname)
  );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await expect(page.getByText("Temporary chat", { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByRole("link", { name: /New Chat/u })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open documentation" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /logo/u })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-empty.png"),
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply with exactly: temporary chat works");
  const creation = page.waitForResponse((response) =>
    response.url().endsWith("/api/eve-guest")
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const response = await creation;
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const binding = bindingSchema.parse(await response.json());
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "temporary chat works",
    { timeout: 90_000 }
  );
  await expect(page).toHaveURL(/\/$/u);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-response.png"),
  });
  const stream = `/eve/guest/v1/session/${binding.sessionId}/stream?includeTailIndex=1`;
  const unauthenticated = await page.request.get(stream);
  const otherSession = await page.request.get(
    stream.replace(binding.sessionId, "someone-else"),
    { headers: { authorization: `Bearer ${binding.credential}` } }
  );
  expect(unauthenticated.status()).toBe(401);
  expect(otherSession.status()).toBe(401);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(
    requests.some(
      (path) =>
        path.startsWith("/api/trpc") ||
        path.startsWith("/api/agent-conversations")
    )
  ).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/u);
  expect(errors).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("guest bootstrap failures preserve the draft and expired sessions offer a fresh  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("guest bootstrap failures preserve the draft and expired sessions offer a fresh  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("guest bootstrap failures preserve the draft and expired sessions offer a fresh  uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("guest bootstrap failures preserve the draft and expired sessions offer a fresh  accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("guest bootstrap failures preserve the draft and expired sessions offer a fresh  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("guest bootstrap failures preserve the draft and expired sessions offer a fresh start", async ({
  page,
}, testInfo) => {
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  await page.route("**/api/eve-guest", (route) =>
    route.fulfill({ json: { error: "Unavailable" }, status: 502 })
  );
  await page.goto("/");
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Keep this draft");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not start chat" })
  ).toBeVisible();
  await expect(composer).toHaveText("Keep this draft");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-bootstrap-error.png"),
  });
  await page.unroute("**/api/eve-guest");
  await page.route("**/api/eve-guest", (route) =>
    route.fulfill({
      json: {
        credential: "expired-fixture",
        expiresAt: 0,
        sessionId: "expired-session",
      },
    })
  );
  await page.route("**/eve/guest/v1/session/**", (route) =>
    route.fulfill({
      json: { error: "This temporary chat has expired." },
      status: 401,
    })
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("This chat has expired. Start a new chat to continue.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeDisabled();
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-expired-mobile.png"),
  });
  await page.getByRole("button", { exact: true, name: "New chat" }).click();
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "expired" })
  ).toHaveCount(0);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("guest shell keeps release controls and New Chat clears the in-memory draft") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): test("guest shell keeps release controls and New Chat clears the in-memory draft") accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("guest shell keeps release controls and New Chat clears the in-memory draft") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("guest shell keeps release controls and New Chat clears the in-memory draft", async ({
  page,
}, testInfo) => {
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  await page.goto("/");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await expect(
    page.getByRole("main").getByRole("button", { exact: true, name: "Sign in" })
  ).toBeVisible();
  await expect(page.locator('a[href="/settings/models"]')).toBeVisible();
  await composer.fill("Discard this draft");
  await page.getByRole("link", { name: /New Chat/u }).click();
  await expect(composer).toHaveText("");
  await composer.fill("Discard with shortcut");
  await composer.press("ControlOrMeta+Shift+O");
  await expect(composer).toHaveText("");
  await page.getByRole("button", { name: /logo/u }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal { display:none !important; }",
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-model-picker.png"),
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-welcome-mobile.png"),
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("New Chat discards late bootstrap results and retires their session") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("New Chat discards late bootstrap results and retires their session") uses 60_000, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("New Chat discards late bootstrap results and retires their session") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test("New Chat discards late bootstrap results and retires their session") accepts { page, }; route; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("New Chat discards late bootstrap results and retires their session") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("New Chat discards late bootstrap results and retires their session", async ({
  page,
}) => {
  const started = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const messages: string[] = [];
  await page.route("**/api/eve-guest", async (route) => {
    started.resolve(undefined);
    await release.promise;
    await route.fulfill({
      json: {
        credential: "fixture",
        expiresAt: Date.now() + 60_000,
        sessionId: "discarded-session",
      },
    });
  });
  await page.route("**/eve/guest/v1/session/**", (route) => {
    if (route.request().method() === "POST") {
      messages.push(new URL(route.request().url()).pathname);
    }
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Discard this private message");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await started.promise;
  await page.getByRole("link", { name: /New Chat/u }).click();
  await expect(composer).toHaveText("");
  await composer.fill("Fresh draft");
  const retired = page.waitForRequest((request) =>
    request.url().endsWith("/discarded-session/reset")
  );
  release.resolve(undefined);
  await retired;
  await expect(composer).toHaveText("Fresh draft");
  await expect(page.getByRole("log")).toHaveCount(0);
  expect(messages).toEqual(["/eve/guest/v1/session/discarded-session/reset"]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("back-forward cache restoration starts a fresh guest chat") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("back-forward cache restoration starts a fresh guest chat") accepts { page, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("back-forward cache restoration starts a fresh guest chat") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("back-forward cache restoration starts a fresh guest chat", async ({
  page,
}) => {
  await page.route("**/api/eve-guest", (route) =>
    route.fulfill({
      json: {
        credential: "fixture",
        expiresAt: 0,
        sessionId: "retired-session",
      },
    })
  );
  await page.route("**/eve/guest/v1/session/**", (route) =>
    route.fulfill({ json: { error: "Expired" }, status: 401 })
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Old chat");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("This chat has expired. Start a new chat to continue.")
  ).toBeVisible();
  await page.evaluate(() =>
    globalThis.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    )
  );
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
