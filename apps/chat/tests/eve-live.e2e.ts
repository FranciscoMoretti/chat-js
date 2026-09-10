import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const conversationUrl = /\/chat\/[^/]+$/;

test("real provider, native application tool and replay-safe usage ledger", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      'Use the wordCount tool to count "one two three four". Report the result as "4 words".'
    );
  const creation = page.waitForResponse("**/api/agent-conversations");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const created = await creation;
  expect(
    created.ok(),
    JSON.stringify({
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
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, id));
  if (!conversation?.sessionId) {
    throw new Error("Missing session binding.");
  }
  const usage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(usage.length).toBeGreaterThan(0);
  expect(usage.every((row) => row.costUsd !== null)).toBe(true);
  const charged = usage.reduce((total, row) => total + row.chargedCents, 0);
  expect(charged).toBeGreaterThan(0);
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const replayed = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(replayed.reduce((total, row) => total + row.chargedCents, 0)).toBe(
    charged
  );
  await page.reload();
  await expect(page.getByRole("log")).toContainText("4 words");
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  const toolCard = page
    .getByText("Words", { exact: true })
    .locator("..")
    .locator("..");
  await toolCard.screenshot({
    path: "tests/eve-results/screenshots/tool-word-count.png",
    animations: "disabled",
  });
});

test("the composer selects models for initial and subsequent durable turns", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
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
    path: "tests/eve-results/screenshots/eve-model-picker.png",
    animations: "disabled",
  });
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Reply with hello.");
  const creation = page.waitForResponse("**/api/agent-conversations");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const created = await creation;
  expect(created.request().postDataJSON().modelId).toBe(
    "openai/gpt-4.1-mini-fast"
  );
  expect(
    created.ok(),
    JSON.stringify({
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
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, id));
  if (!conversation?.sessionId) {
    throw new Error("Missing session");
  }
  const endpoint = `/api/eve/v1/session/${conversation.sessionId}`;
  const rejected = await page.request.post(endpoint, {
    headers: { origin: new URL(page.url()).origin },
    data: { message: "Do not dispatch this", modelId: "invalid-model" },
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
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Reply exactly model-switch-ok");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toBeEmpty();
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    headers: {
      authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
      "x-chatjs-owner": conversation.ownerId,
    },
  });
  await expect
    .poll(
      async () => {
        const current = await client.sessions
          .attach(conversation.sessionId ?? "")
          .snapshot();
        return current.events.filter((event) => event.type === "turn.completed")
          .length;
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
    (event) => event.type === "step.started"
  );
  expect(firstStep?.data.modelId).toBe("gateway/openai/gpt-4.1-mini-fast");
  await expect(
    page.getByTestId("model-selector").filter({ visible: true })
  ).toContainText("GPT-4.1");
  const lastStep = snapshot.events.findLast(
    (event) => event.type === "step.started"
  );
  expect(lastStep?.data.modelId).toBe(`gateway/${selected}`);
  expect(
    snapshot.events.filter((event) => event.type === "message.received")
  ).toHaveLength(2);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      'Call confirm_note with the note "model approval check" and wait for my approval.'
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Waiting for your input", { exact: true })
  ).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(
    page.getByText("Waiting for your input", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const approved = await client.sessions
    .attach(conversation.sessionId)
    .snapshot();
  const approvalSteps = approved.events
    .slice(snapshot.events.length)
    .filter((event) => event.type === "step.started");
  expect(approvalSteps.length).toBeGreaterThanOrEqual(2);
  for (const step of approvalSteps) {
    if (step.type === "step.started") {
      expect(step.data.modelId).toBe(`gateway/${selected}`);
      expect(step.data.turnId).not.toBe("");
      expect(
        approved.events.some(
          (event) =>
            event.type === "turn.started" &&
            event.data.turnId === step.data.turnId
        )
      ).toBe(true);
    }
  }
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const chargedUsage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(chargedUsage.length).toBeGreaterThanOrEqual(4);
  for (const entry of chargedUsage) {
    expect(entry.turnId).not.toBe("");
    expect(entry.costUsd).not.toBeNull();
    expect(
      approved.events.some(
        (event) =>
          event.type === "turn.started" && event.data.turnId === entry.turnId
      )
    ).toBe(true);
  }
  const chargedCents = chargedUsage.reduce(
    (total, row) => total + row.chargedCents,
    0
  );
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const replayedUsage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(
    replayedUsage.reduce((total, row) => total + row.chargedCents, 0)
  ).toBe(chargedCents);
});

test("a definitive model rejection unlocks the composer and releases the operation", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page.route("**/api/agent-conversations", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "This model is not available for chat.",
        creationRejected: true,
      }),
    })
  );
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Retain my draft");
  const firstRequest = page.waitForRequest("**/api/agent-conversations");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const first = (await firstRequest).postDataJSON();
  await expect(
    page.getByRole("alert").filter({ hasText: "This model is not available" })
  ).toBeVisible();
  const picker = page.getByTestId("model-selector").filter({ visible: true });
  await expect(picker).toBeEnabled();
  await picker.click();
  await page.getByPlaceholder("Search models...").fill("GPT-4.1 mini");
  await page.getByRole("option").filter({ hasText: "GPT-4.1 mini" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toHaveText("Retain my draft");
  const secondRequest = page.waitForRequest("**/api/agent-conversations");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const second = (await secondRequest).postDataJSON();
  expect(second.operationId).not.toBe(first.operationId);
  expect(second.modelId).toBe("openai/gpt-4.1-mini-fast");
});
