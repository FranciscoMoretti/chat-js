import { z } from "zod";
import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { eq, getTableColumns } from "drizzle-orm";
import { Client } from "eve/client";
import type { SessionStreamEvent } from "eve/client";

import { getEvePostgresStreamPositions } from "@/lib/eve/lifecycle/postgres/eve-stream-positions";

import { db } from "../lib/db/client";
import { getEveUsageCursor } from "../lib/db/eve-billing";
import { eveChat, eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { EVE_MESSAGE_OPERATION_HEADER } from "../lib/eve/message-delivery";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

type TurnStartedEventReader =
  | {
      readonly type: "turn.started";
      readonly data: Readonly<
        Extract<SessionStreamEvent, { type: "turn.started" }>["data"]
      >;
    }
  | {
      readonly type: Exclude<SessionStreamEvent["type"], "turn.started">;
      readonly data?: unknown;
    };

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const conversationUrl = /\/chat\/[^/]+$/u;

test("real provider, native application tool and replay-safe usage ledger", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultNavigationTimeout(120_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
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
      request: created.request().postData(),
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
  if (id === undefined || id === null || id === "") {
    throw new Error("Missing conversation identity.");
  }
  const [conversation] = await db
    .select({
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, id));
  if (
    conversation === undefined ||
    conversation === null ||
    conversation.sessionId === undefined ||
    conversation.sessionId === null ||
    conversation.sessionId === ""
  ) {
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
          (event: Readonly<Pick<SessionStreamEvent, "type">>) =>
            event.type === "compaction.completed"
        );
      },
      { intervals: [1000], timeout: 90_000 }
    )
    .toBe(true);
  const compactionUsage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, sessionId));
  const maintenance = compactionUsage.filter(
    (row) => row.turnId === "chatjs:maintenance" && row.modelAttempt !== null
  );
  expect(maintenance.length).toBeGreaterThan(0);
  for (const recorded of maintenance) {
    expect(recorded.ownerId).toBe(ownerId);
    expect(Number(recorded.costUsd)).toBeGreaterThan(0);
    expect(recorded.modelAttempt).toMatchObject({
      ownerId,
      sessionId,
      state: "returned",
    });
  }
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

test("the composer selects models for initial and subsequent durable turns", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
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

  expect(
    z
      .looseObject({ modelId: z.string() })
      .parse(created.request().postDataJSON()).modelId
  ).toBe("openai/gpt-4.1-mini-fast");
  expect(
    created.ok(),
    JSON.stringify({
      request: created.request().postData(),
      status: created.status(),
    })
  ).toBe(true);
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (id === undefined || id === null || id === "") {
    throw new Error("Missing conversation ID");
  }
  const [conversation] = await db
    .select({
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, id));
  if (
    conversation === undefined ||
    conversation === null ||
    conversation.sessionId === undefined ||
    conversation.sessionId === null ||
    conversation.sessionId === ""
  ) {
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
          (event: Readonly<Pick<SessionStreamEvent, "type">>) =>
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
      event: Readonly<Pick<SessionStreamEvent, "type">>
    ): event is Extract<SessionStreamEvent, { type: "step.started" }> =>
      event.type === "step.started"
  );
  expect(firstStep?.data.modelId).toBe("gateway/openai/gpt-4.1-mini-fast");
  await expect(
    page.getByTestId("model-selector").filter({ visible: true })
  ).toContainText("GPT-4.1");
  const lastStep = snapshot.events.findLast(
    (
      event: Readonly<Pick<SessionStreamEvent, "type">>
    ): event is Extract<SessionStreamEvent, { type: "step.started" }> =>
      event.type === "step.started"
  );
  expect(lastStep?.data.modelId).toBe(`gateway/${selected}`);
  expect(
    snapshot.events.filter(
      (event: Readonly<Pick<SessionStreamEvent, "type">>) =>
        event.type === "message.received"
    )
  ).toHaveLength(2);
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const [activeConversation] = await db
    .select({
      ...getTableColumns(eveConversation),
      updatedAt: eveChat.updatedAt,
    })
    .from(eveConversation)
    .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
    .where(eq(eveConversation.id, conversation.id));
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

test("a definitive model rejection unlocks the composer and releases the operation", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page.route("**/api/agent-conversations", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: "This model is not available for chat.",
        creationRejected: true,
      }),
      contentType: "application/json",
      status: 400,
    });
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Retain my draft");
  const firstRequest = page.waitForRequest("**/api/agent-conversations");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const firstRequestResult = await firstRequest;

  const first = z
    .looseObject({ operationId: z.string() })
    .parse(firstRequestResult.postDataJSON());
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

  const second = z
    .looseObject({ operationId: z.string(), modelId: z.string() })
    .parse(secondRequestResult.postDataJSON());

  expect(second.operationId).not.toBe(first.operationId);

  expect(second.modelId).toBe("openai/gpt-4.1-mini-fast");
});
