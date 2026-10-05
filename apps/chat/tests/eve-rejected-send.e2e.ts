/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, userCredit } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { conversationBinding } from "../lib/eve/contracts";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("rejected send survives reload as an unsent draft and can be restored and sent o keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("rejected send survives reload as an unsent draft and can be restored and sent o keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("rejected send survives reload as an unsent draft and can be restored and sent o uses 210_000, 402, 0, 1, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("rejected send survives reload as an unsent draft and can be restored and sent o accepts { page, }; testInfo; route; response; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("rejected send survives reload as an unsent draft and can be restored and sent o preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("rejected send survives reload as an unsent draft and can be restored and sent once", async ({
  page,
}, testInfo) => {
  test.setTimeout(210_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply only with ready.",
      modelId: "openai/gpt-4.1-mini-fast",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, conversation.ownerId));
  expect(balance).toBeDefined();
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  const unsent = "Reply only with recovered-message-73.";
  try {
    await db
      .update(userCredit)
      .set({ credits: 0 })
      .where(eq(userCredit.userId, conversation.ownerId));
    await composer.fill(unsent);
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/eve/v1/session/${binding.sessionId}`)
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    const response = await rejected;
    expect(response.status()).toBe(402);
    expect(await response.json()).toMatchObject({
      code: "chatjs_command_rejected",
    });
    await expect(
      page.getByText("Message was not sent:", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Message delivery is unconfirmed.", { exact: false })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Reconnect" })
    ).toHaveCount(0);
    await expect(page.getByRole("log")).not.toContainText(unsent);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("rejected-send.png"),
      style: "nextjs-portal { display: none !important; }",
    });
    await page.reload();
    await expect(
      page.getByText("Message was not sent:", { exact: false })
    ).toBeVisible();
    await expect(page.getByRole("log")).not.toContainText(unsent);
    await expect(
      page.getByRole("button", { exact: true, name: "Reconnect" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { exact: true, name: "Restore draft" })
      .click();
    await expect(composer).toHaveText(unsent);
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
  } finally {
    await db
      .update(userCredit)
      .set({ credits: balance.credits })
      .where(eq(userCredit.userId, conversation.ownerId));
  }
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText("recovered-message-73", {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("log").getByText(unsent, { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { exact: true, name: "Restore draft" })
  ).toHaveCount(0);

  const commandUrl = new URL(
    `/api/eve/v1/session/${binding.sessionId}`,
    page.url()
  ).href;
  const operationIds: string[] = [];
  await page.route(commandUrl, (route) => {
    operationIds.push(route.request().headers()["x-chatjs-message-operation"]);
    return route.fulfill({
      body: JSON.stringify({
        code: "usage_reconciliation_busy",
        error: "Usage reconciliation is busy.",
        retryable: true,
      }),
      contentType: "application/json",
      headers: { "Retry-After": "2" },
      status: 503,
    });
  });
  const retryMessage = "Reply only with busy-message-74.";
  await composer.fill(retryMessage);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const retryButton = page.getByRole("button", {
    exact: true,
    name: "Retry message",
  });
  await expect(retryButton).toBeVisible({ timeout: 45_000 });
  expect(operationIds.length).toBeGreaterThan(1);
  expect(new Set(operationIds).size).toBe(1);
  await page.reload();
  await expect(retryButton).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("busy-message-retry.png"),
    style: "nextjs-portal { display: none !important; }",
  });
  await page.unroute(commandUrl);
  const retriedRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url() === commandUrl
  );
  await retryButton.click();
  const retryRequest = await retriedRequest;
  expect(retryRequest.headers()["x-chatjs-message-operation"]).toBe(
    operationIds[0]
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("log").getByText(retryMessage, { exact: true })
  ).toHaveCount(1);
  await expect(retryButton).toHaveCount(0);

  // An unmarked upstream error is ambiguous even when its HTTP status is 4xx.
  await page.route(commandUrl, (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "Upstream response failed" }),
      contentType: "application/json",
      status: 400,
    })
  );
  await composer.fill("Retain ambiguous delivery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("Message delivery is unconfirmed.", { exact: false })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Reconnect" })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("uncertain-send.png"),
    style: "nextjs-portal { display: none !important; }",
  });

  const failedRead = await page.request.get(
    "/api/eve/v1/session/nonexistent-session/stream"
  );
  expect(failedRead.status()).toBe(404);
  expect(await failedRead.json()).not.toHaveProperty("code");
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
