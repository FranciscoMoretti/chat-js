/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/env"; "../lib/eve/contracts"; "../lib/eve/response-group-contracts" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, test } from "@playwright/test";

import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("two cheap native responses bind, render, and preserve an unsent draft while swi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("two cheap native responses bind, render, and preserve an unsent draft while swi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("two cheap native responses bind, render, and preserve an unsent draft while swi uses 150_000, 0, 8, 200, 1, 202, 1000, 2000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("two cheap native responses bind, render, and preserve an unsent draft while swi sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("two cheap native responses bind, render, and preserve an unsent draft while swi accepts { page, }; testInfo; route; result; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("two cheap native responses bind, render, and preserve an unsent draft while swi preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("two cheap native responses bind, render, and preserve an unsent draft while switching", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const marker = `comparison-${crypto.randomUUID().slice(0, 8)}`;
  const message = `Reply with exactly ${marker}. Do not call tools.`;
  const response = await page.request.post("/api/agent-response-groups", {
    data: {
      message,
      modelIds: [
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-lite",
      ],
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
    timeout: 90_000,
  });
  expect(response.status()).toBe(200);
  const group = eveResponseGroupResult.parse(await response.json());
  expect(group.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
  ]);
  const [first, second] = group.candidates;
  if (first.state !== "bound" || second.state !== "bound") {
    throw new Error("Native comparison did not bind both candidates.");
  }
  try {
    expect(first.sessionId).not.toBe(second.sessionId);
    await page.context().addCookies([
      {
        name: "chat-model",
        url: new URL(page.url()).origin,
        value: "openai/gpt-5-mini",
      },
    ]);
    await page.goto(`/chat/${first.conversationId}`);
    const activeChat = page.locator(
      'a[data-sidebar="menu-button"][data-active="true"]'
    );
    await expect(activeChat).toHaveCount(1);
    const chatHref = await activeChat.getAttribute("href");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("GPT-5 mini");
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("Keep this unsent comparison follow-up");
    await page
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(
      new URL(`/chat/${second.conversationId}`, page.url()).href
    );
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveText("Keep this unsent comparison follow-up");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("Gemini 2.5 Flash Lite");
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await page.reload();
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("Gemini 2.5 Flash Lite");
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveText("Keep this unsent comparison follow-up");
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("native-comparison.png"),
    });
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("");
    // Retry belongs to the same model card even though EVE creates another session.
    const regenerationResponse = page.waitForResponse(
      (result) =>
        result.url().endsWith("/api/agent-conversations") &&
        result.request().method() === "POST"
    );
    await page
      .getByRole("log")
      .getByRole("button", { exact: true, name: "Retry" })
      .click();
    const regeneration = await regenerationResponse;
    expect(regeneration.ok()).toBe(true);
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the actual regeneration wire payload directly; this assertion verifies the fork-kind contract.
    expect(regeneration.request().postDataJSON().forkKind).toBe("regenerate");
    const retry = conversationBinding.parse(await regeneration.json());
    await expect(page).toHaveURL(new URL(`/chat/${retry.id}`, page.url()).href);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    const userRow = page.getByRole("log").locator(".is-user");
    await expect(
      userRow.getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
    ).toHaveCount(1);
    await userRow
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(
      new URL(`/chat/${first.conversationId}`, page.url()).href
    );
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await userRow
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(new URL(`/chat/${retry.id}`, page.url()).href);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(userRow).toHaveCount(1);
    await expect(
      page.getByRole("button", { exact: true, name: "Previous version" })
    ).toHaveCount(0);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    // Both comparison roots belong to one logical chat and are deleted together.
    await expect
      .poll(
        async () => {
          const deletion = await page.request.delete(
            `/api/agent-conversations/${first.conversationId}`,
            {
              headers: { origin: new URL(page.url()).origin },
              timeout: 30_000,
            }
          );
          expect([200, 202]).toContain(deletion.status());
          return deletion.status();
        },
        { intervals: [1000, 2000], timeout: 120_000 }
      )
      .toBe(200);
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
