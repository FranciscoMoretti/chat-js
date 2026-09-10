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
  await page.getByRole("button", { name: "Send", exact: true }).click();
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

test("a selected model applies to the next durable turn", async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Reply with hello.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
  const selected = "openai/gpt-4.1-mini";
  const response = await page.request.post(endpoint, {
    headers: { origin: new URL(page.url()).origin },
    data: { message: "Reply exactly model-switch-ok", modelId: selected },
  });
  expect(response.ok()).toBe(true);
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
  const lastStep = snapshot.events.findLast(
    (event) => event.type === "step.started"
  );
  expect(lastStep?.data.modelId).toBe(`gateway/${selected}`);
  expect(
    snapshot.events.filter((event) => event.type === "message.received")
  ).toHaveLength(2);
});
