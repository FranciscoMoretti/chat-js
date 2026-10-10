/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */

import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { Response } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.

import { conversationBinding } from "../lib/eve/contracts";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

const sourceModelId = "openai/gpt-5-nano";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/no-null --
 * init-declarations (#507): test("edit recovery and regeneration create navigable versions inside ChatJS") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("edit recovery and regeneration create navigable versions inside ChatJS") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("edit recovery and regeneration create navigable versions inside ChatJS") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("edit recovery and regeneration create navigable versions inside ChatJS") uses 180_000, 1, 150_000, 200, 1000, 2000, 5000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("edit recovery and regeneration create navigable versions inside ChatJS") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): test("edit recovery and regeneration create navigable versions inside ChatJS") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.setViewportSize() on the original Page/locator receiver to change the live browser or route state.
test("edit recovery and regeneration create navigable versions inside ChatJS", async ({
  page,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright TestInfo callback calls testInfo.setTimeout()/testInfo.annotations() to update the native test runner timeout/attachment state.
}, testInfo) => {
  test.setTimeout(180_000);
  let cleanup: { id: string; origin: string } | undefined;
  let bodyFailed = false;
  let cleanupFailure: { error: unknown } | undefined;
  try {
    await page.route(
      "https://unpkg.com/react-scan/**",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
      (route) => route.abort()
    );
    await page.goto("/api/dev-login");
    const { origin } = new URL(page.url());
    await page.request.post("/api/chat-model", {
      data: { model: sourceModelId },
    });
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: "Reply briefly with amber.",
        modelId: sourceModelId,
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    cleanup = { id: source.id, origin };
    await page.goto(`/chat/${source.id}`);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const userMessage = page.getByRole("log").locator(".is-user").first();
    const editor = userMessage.getByRole("group", {
      name: "Message composer",
    });
    await expect(editor).toBeVisible();
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Reply briefly with cobalt.");
    await userMessage.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edit-inline.png"),
    });

    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ height: 844, width: 390 });
    await userMessage.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edit-inline-mobile.png"),
    });
    if (desktopViewport) {
      await page.setViewportSize(desktopViewport);
    }

    let accepted: ReturnType<typeof conversationBinding.parse> | undefined;
    await page.route(
      "**/api/agent-conversations",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fetch() and route.abort() to resolve the intercepted live request through the original native Route receiver.
      async (route) => {
        const response = await route.fetch();
        accepted = conversationBinding.parse(await response.json());
        await route.abort("failed");
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeEnabled({ timeout: 60_000 });
    expect(accepted).toBeDefined();
    await page.reload();
    await expect(
      page
        .getByRole("region", { name: "Version recovery" })
        .filter({ hasText: "Response creation is unconfirmed" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Recover version" }).click();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from accepted; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    await expect(page).toHaveURL(new RegExp(`/chat/${accepted?.id}$`, "u"), {
      timeout: 60_000,
    });
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "cobalt"
    );
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
    await expect(
      page.getByRole("log").locator(".is-user").first()
    ).toContainText("2/2");
    await page.getByRole("log").screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edited-messages.png"),
    });
    await page.getByTestId("model-selector").filter({ visible: true }).click();
    await page.getByPlaceholder("Search models...").fill("GPT-5 mini");
    await page
      .getByRole("option", { exact: true, name: "openai logo GPT-5 mini" })
      .filter({
        hasNot: page.getByTitle("Advanced reasoning capabilities", {
          exact: true,
        }),
      })
      .click();
    // Reload proves regeneration comes from durable response evidence, not a local selection cache.
    await page.reload();
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    const regenerated = page.waitForResponse(
      (response: Readonly<Pick<Response, "request" | "url">>) =>
        response.url().endsWith("/api/agent-conversations") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { exact: true, name: "Retry" }).click();
    const regeneration = await regenerated;
    expect(regeneration.ok()).toBe(true);
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the actual regeneration request payload; this assertion verifies the selected model survives editing.
    expect(regeneration.request().postDataJSON().modelId).toBe(sourceModelId);
    await expect(page).not.toHaveURL(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from accepted; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      new RegExp(`/chat/${accepted?.id}$`, "u"),
      {
        timeout: 60_000,
      }
    );
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("log").locator(".is-user").first()
    ).toContainText("2/2");
    await expect(
      page.getByRole("log").locator(".is-assistant").first()
    ).toContainText("2/2");
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "cobalt"
    );
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
    await page
      .getByRole("log")
      .locator(".is-user")
      .first()
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("version-navigation.png"),
      });
    await userMessage.hover();
    await userMessage
      .getByRole("button", { exact: true, name: "Previous version" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/chat/${source.id}$`, "u"));
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "amber"
    );
    await expect(page.getByRole("log")).not.toContainText("cobalt");
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Keep this edited violet draft.");
    await page.route(
      "**/api/agent-conversations",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
      (route) =>
        route.fulfill({
          json: { error: "Temporary test outage" },
          status: 503,
        }),
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("log").locator(".is-user").first()
    ).toContainText("1/2");
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeVisible();
    await page.getByRole("region", { name: "Version recovery" }).screenshot({
      animations: "disabled",
      path: testInfo.outputPath("retained-edit.png"),
    });
    await page.route(
      "**/api/agent-conversations",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
      (route) =>
        route.fulfill({
          json: { creationRejected: true, error: "Test model rejection" },
          status: 400,
        }),
      { times: 1 }
    );
    await page.getByRole("button", { name: "Recover version" }).click();
    await expect(
      editor.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText("Keep this edited violet draft.");
    await expect(userMessage).toContainText("Test model rejection");
    let replacement: unknown;
    await page.route(
      "**/api/agent-conversations",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
      async (route) => {
        replacement = route.request().postDataJSON();
        await route.fulfill({
          json: { creationRejected: true, error: "End of test" },
          status: 400,
        });
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(userMessage).toContainText("End of test");
    expect(replacement).toMatchObject({
      fork: { beforeTurnId: "turn_0", conversationId: source.id },
      message: "Keep this edited violet draft.",
    });
  } catch (error) {
    bodyFailed = true;
    throw error;
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    if (cleanup) {
      const url = `/api/agent-conversations/${cleanup.id}`;
      const headers = { origin: cleanup.origin };
      try {
        await expect
          .poll(
            async () => {
              const response = await page.request
                .delete(url, { headers, timeout: 30_000 })
                .catch(() => null);
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from response; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
              if (response?.status() !== 200) {
                return null;
              }
              const responseBody: unknown = await response.json();
              return responseBody;
            },
            { intervals: [1000, 2000, 5000], timeout: 90_000 }
          )
          .toEqual({ rootId: cleanup.id, status: "deleted" });
      } catch (error) {
        if (!bodyFailed) {
          cleanupFailure = { error };
        }
        testInfo.annotations.push({
          description: "Native conversation family cleanup also failed.",
          type: "cleanup",
        });
      }
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/no-null */
