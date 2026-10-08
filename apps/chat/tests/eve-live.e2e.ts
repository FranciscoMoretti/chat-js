// oxlint-disable-next-line import/no-nodejs-modules -- This Playwright E2E fixture runs in Node and intentionally uses this built-in.
import { mkdir } from "node:fs/promises";
/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:fs/promises" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { mkdir } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-billing"; "@/lib/eve/lifecycle/postgres/eve-stream-positions"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.

/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, getTableColumns } from "drizzle-orm";
/* oxlint-enable eslint/sort-imports */
import { Client } from "eve/client";
import type { MessageStreamEvent } from "eve/client";

import { getEvePostgresStreamPositions } from "@/lib/eve/lifecycle/postgres/eve-stream-positions";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.

/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable eslint/sort-imports */
import { getEveUsageCursor } from "../lib/db/eve-billing";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveChat, eveConversation, eveUsage } from "../lib/db/schema";
/* oxlint-enable eslint/sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EVE_MESSAGE_OPERATION_HEADER } from "../lib/eve/message-delivery";
/* oxlint-enable eslint/sort-imports */
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

type TurnStartedEventReader =
  | {
      readonly type: "turn.started";
      readonly data: Readonly<
        Extract<MessageStreamEvent, { type: "turn.started" }>["data"]
      >;
    }
  | {
      readonly type: Exclude<MessageStreamEvent["type"], "turn.started">;
      readonly data?: unknown;
    };

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

const conversationUrl = /\/chat\/[^/]+$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("real provider, native application tool and replay-safe usage ledger") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("real provider, native application tool and replay-safe usage ledger") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("real provider, native application tool and replay-safe usage ledger") uses 180_000, 120_000, -1, 0, 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("real provider, native application tool and replay-safe usage ledger") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("real provider, native application tool and replay-safe usage ledger") intentionally keeps the existing falsy-value behavior of id; conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.setDefaultNavigationTimeout(), page.route(), page.goto() on the original Page/locator receiver to change the live browser or route state.
test("real provider, native application tool and replay-safe usage ledger", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultNavigationTimeout(120_000);
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash" },
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      'Use the wordCount tool to count "one two three four". Report the result as "4 words".'
    );
  const creation = page.waitForResponse("**/api/agent-conversations");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const created = await creation;
  expect(
    created.ok(),
    JSON.stringify({
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
      request: created.request().postDataJSON(),
      status: created.status(),
    })
  ).toBe(true);
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.getByText("Words", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("log")).toContainText("4 words", {
    timeout: 90_000,
  });
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (!id) {
    throw new Error("Missing conversation identity.");
  }
  const [conversation] = await db
    .select({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing getTableColumns(eveConversation) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, id));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from conversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!conversation?.sessionId) {
    throw new Error("Missing session binding.");
  }
  const { ownerId, sessionId } = conversation;
  const usage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  expect(usage.length).toBeGreaterThan(0);
  expect(
    usage.every(
      (row: { readonly costUsd: string | null }) => row.costUsd !== null
    )
  ).toBe(true);
  const charged = usage.reduce(
    (total, row: { readonly chargedCents: number }) => total + row.chargedCents,
    0
  );
  expect(charged).toBeGreaterThan(0);
  await reconcileEveUsage(ownerId, sessionId);
  // Exercise the actual Eve-created default stream, not a fixture that shares
  // the adapter's naming assumption. This catches SDK mapping changes on upgrade.
  await expect
    .poll(
      async () => {
        await reconcileEveUsage(ownerId, sessionId);
        const positions = await getEvePostgresStreamPositions(
          env.WORKFLOW_POSTGRES_URL ?? "",
          [sessionId]
        );
        const cursor = await getEveUsageCursor(ownerId, sessionId);
        return cursor > 0 && positions.get(sessionId) === cursor;
      },
      { intervals: [1000], timeout: 10_000 }
    )
    .toBe(true);
  const replayed = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  expect(
    replayed.reduce(
      (total, row: { readonly chargedCents: number }) =>
        total + row.chargedCents,
      0
    )
  ).toBe(charged);
  const client = new Client(getEveConnectionOptions(ownerId));
  const session = client.sessions.attach(sessionId);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const compactionResult = await session.compact();
  expect(compactionResult.status).toBe("accepted");
  await expect
    .poll(
      async () => {
        const snapshot = await session.snapshot();
        return snapshot.events.some(
          (event: Readonly<Pick<MessageStreamEvent, "type">>) =>
            event.type === "compaction.completed"
        );
      },
      { intervals: [1000], timeout: 90_000 }
    )
    .toBe(true);
  const compacted = await session.snapshot();
  const compactionUsage = compacted.events.filter(
    (
      event: Readonly<Pick<MessageStreamEvent, "type">>
    ): event is Extract<MessageStreamEvent, { type: "compaction.usage" }> =>
      event.type === "compaction.usage"
  );
  expect(compactionUsage.length).toBeGreaterThan(0);
  for (const event of compactionUsage) {
    expect(event.meta.id.startsWith("evt_")).toBe(true);
    expect(event.data.sessionId).toBe(sessionId);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading costUsd from event.data.usage; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(event.data.usage?.costUsd).toBeGreaterThan(0);
    // No reconciliation before this read: the authored billing hook must have
    // received and recorded the same event delivered by the public client.
    const [recorded] = await db
      .select()
      .from(eveUsage)
      .where(eq(eveUsage.eventId, event.meta.id));
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from recorded; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(recorded?.sessionId).toBe(sessionId);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading costUsd from recorded; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. Keep the existing nullish guard when reading costUsd from event.data.usage; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(Number(recorded?.costUsd)).toBe(event.data.usage?.costUsd);
  }
  const rewind = await client.sessions.attach(sessionId).snapshot();
  expect(
    rewind.events.filter(
      (event: Readonly<Pick<MessageStreamEvent, "type">>) =>
        event.type === "compaction.usage"
    )
  ).toEqual(compactionUsage);
  const beforeReplay = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  await reconcileEveUsage(ownerId, sessionId);
  const afterReplay = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  expect(afterReplay.length).toBe(beforeReplay.length);
  expect(
    afterReplay.reduce(
      (total, row: { readonly chargedCents: number }) =>
        total + row.chargedCents,
      0
    )
  ).toBe(
    beforeReplay.reduce(
      (total, row: { readonly chargedCents: number }) =>
        total + row.chargedCents,
      0
    )
  );
  await page.reload();
  await expect(page.getByRole("log")).toContainText("4 words");
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  const toolCard = page
    .getByText("Words", { exact: true })
    .locator("..")
    .locator("..");
  await toolCard.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/tool-word-count.png",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("the composer selects models for initial and subsequent durable turns") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("the composer selects models for initial and subsequent durable turns") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("the composer selects models for initial and subsequent durable turns") uses -1, 400, 2, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("the composer selects models for initial and subsequent durable turns") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("the composer selects models for initial and subsequent durable turns") intentionally keeps the existing falsy-value behavior of id; conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.reload() on the original Page/locator receiver to change the live browser or route state.
test("the composer selects models for initial and subsequent durable turns", async ({
  page,
}) => {
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page.getByTestId("model-selector").filter({ visible: true }).click();
  await page.getByPlaceholder("Search models...").fill("GPT-4.1 mini");
  await page.getByRole("option").filter({ hasText: "GPT-4.1 mini" }).click();
  await expect(
    page.getByTestId("model-selector").filter({ visible: true })
  ).toContainText("GPT-4.1 mini");
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-model-picker.png",
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply with hello.");
  const creation = page.waitForResponse("**/api/agent-conversations");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const created = await creation;
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
  expect(created.request().postDataJSON().modelId).toBe(
    "openai/gpt-4.1-mini-fast"
  );
  expect(
    created.ok(),
    JSON.stringify({
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
      request: created.request().postDataJSON(),
      status: created.status(),
    })
  ).toBe(true);
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (!id) {
    throw new Error("Missing conversation ID");
  }
  const [conversation] = await db
    .select({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing getTableColumns(eveConversation) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, id));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from conversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!conversation?.sessionId) {
    throw new Error("Missing session");
  }
  const endpoint = `/api/eve/v1/session/${conversation.sessionId}`;
  const rejected = await page.request.post(endpoint, {
    data: { message: "Do not dispatch this", modelId: "invalid-model" },
    headers: {
      [EVE_MESSAGE_OPERATION_HEADER]: crypto.randomUUID(),
      origin: new URL(page.url()).origin,
    },
  });
  expect(rejected.status()).toBe(400);
  expect(conversation.initialModelId).toBe("openai/gpt-4.1-mini-fast");
  const selected = "openai/gpt-4.1-fast";
  await page.getByTestId("model-selector").filter({ visible: true }).click();
  await page.getByPlaceholder("Search models...").fill("GPT-4.1");
  await page
    .getByRole("option")
    .filter({ has: page.getByText("GPT-4.1 (Fast)", { exact: true }) })
    .click();
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply exactly model-switch-ok");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeEmpty();
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  await expect
    .poll(
      async () => {
        const current = await client.sessions
          .attach(conversation.sessionId ?? "")
          .snapshot();
        return current.events.filter(
          (event: Readonly<Pick<MessageStreamEvent, "type">>) =>
            event.type === "turn.completed"
        ).length;
      },
      { timeout: 90_000 }
    )
    .toBe(2);
  await page.reload();
  await expect(page.getByRole("log")).toContainText("model-switch-ok", {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot();
  const firstStep = snapshot.events.find(
    (
      event: Readonly<Pick<MessageStreamEvent, "type">>
    ): event is Extract<MessageStreamEvent, { type: "step.started" }> =>
      event.type === "step.started"
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading data from firstStep; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(firstStep?.data.modelId).toBe("gateway/openai/gpt-4.1-mini-fast");
  await expect(
    page.getByTestId("model-selector").filter({ visible: true })
  ).toContainText("GPT-4.1");
  const lastStep = snapshot.events.findLast(
    (
      event: Readonly<Pick<MessageStreamEvent, "type">>
    ): event is Extract<MessageStreamEvent, { type: "step.started" }> =>
      event.type === "step.started"
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading data from lastStep; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(lastStep?.data.modelId).toBe(`gateway/${selected}`);
  expect(
    snapshot.events.filter(
      (event: Readonly<Pick<MessageStreamEvent, "type">>) =>
        event.type === "message.received"
    )
  ).toHaveLength(2);
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const [activeConversation] = await db
    .select({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing getTableColumns(eveConversation) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, conversation.id));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading updatedAt from activeConversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(activeConversation?.updatedAt.getTime()).toBeGreaterThan(
    conversation.updatedAt.getTime()
  );
  const chargedUsage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(chargedUsage.length).toBeGreaterThanOrEqual(2);
  for (const entry of chargedUsage) {
    expect(entry.turnId).not.toBe("");
    expect(entry.costUsd).not.toBeNull();
    expect(
      snapshot.events.some(
        (event: TurnStartedEventReader) =>
          event.type === "turn.started" && event.data.turnId === entry.turnId
      )
    ).toBe(true);
  }
  const chargedCents = chargedUsage.reduce(
    (total, row: { readonly chargedCents: number }) => total + row.chargedCents,
    0
  );
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const replayedUsage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(
    replayedUsage.reduce(
      (total, row: { readonly chargedCents: number }) =>
        total + row.chargedCents,
      0
    )
  ).toBe(chargedCents);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, typescript/promise-function-async --
 * max-statements (#512): test("a definitive model rejection unlocks the composer and releases the operation") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): test("a definitive model rejection unlocks the composer and releases the operation") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), locator.fill() on the original Page/locator receiver to change the live browser or route state.
test("a definitive model rejection unlocks the composer and releases the operation", async ({
  page,
}) => {
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page.route(
    "**/api/agent-conversations",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          error: "This model is not available for chat.",
          creationRejected: true,
        }),
        contentType: "application/json",
        status: 400,
      })
  );
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Retain my draft");
  const firstRequest = page.waitForRequest("**/api/agent-conversations");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const firstRequestResult = await firstRequest;
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
  const first = firstRequestResult.postDataJSON();
  await expect(
    page.getByRole("alert").filter({ hasText: "This model is not available" })
  ).toBeVisible();
  const picker = page.getByTestId("model-selector").filter({ visible: true });
  await expect(picker).toBeEnabled();
  await picker.click();
  await page.getByPlaceholder("Search models...").fill("GPT-4.1 mini");
  await page.getByRole("option").filter({ hasText: "GPT-4.1 mini" }).click();
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveText("Retain my draft");
  const secondRequest = page.waitForRequest("**/api/agent-conversations");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const secondRequestResult = await secondRequest;
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
  const second = secondRequestResult.postDataJSON();
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
  expect(second.operationId).not.toBe(first.operationId);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Capture actual creation request JSON for retry and model assertions rather than normalizing the wire payload before checking it.
  expect(second.modelId).toBe("openai/gpt-4.1-mini-fast");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-live.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
