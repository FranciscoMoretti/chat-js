import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
import { eveConversation } from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("copies completed history and current document revisions into independent comparisons", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const message = `Reply with exactly ${token} in plain text. Do not invoke any tools.`;
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message,
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.status()).toBe(200);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(
    page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const [binding] = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const document = {
    content: "Captured document",
    conversationId: source.id,
    documentId: crypto.randomUUID(),
    expectedRevisionId: null,
    fileIds: [],
    kind: "text" as const,
    operationId: crypto.randomUUID(),
    ownerId: binding.ownerId,
    title: "Current copy fixture",
    turnIndex: 0,
  };
  const original = await saveEveDocumentRevision(document);
  const later = await saveEveDocumentRevision({
    ...document,
    content: "Current source edit",
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
    turnIndex: null,
  });
  const copied = await page.request.post("/api/agent-response-groups", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      fork: { conversationId: source.id },
      message:
        "Repeat your previous answer verbatim, as plain text. Do not call tools.",
      modelIds: [
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-lite",
      ],
    },
  });
  expect(copied.status()).toBe(200);
  const group = eveResponseGroupResult.parse(await copied.json());
  expect(group.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
  ]);
  /* oxlint-disable eslint/no-await-in-loop -- Inspect each independent candidate in the same browser page. */
  for (const candidate of group.candidates) {
    if (candidate.state !== "bound") {
      throw new Error("Copy did not bind");
    }
    expect(candidate.sessionId).not.toBe(source.sessionId);
    const revision = await getEveDocumentRevision(
      binding.ownerId,
      candidate.conversationId,
      document.documentId
    );
    expect(revision?.id).toBe(later.id);
    await page.goto(`/chat/${candidate.conversationId}`);
    await expect(
      page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
    ).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  }
  /* oxlint-enable eslint/no-await-in-loop */
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("current-copy.png"),
  });
});
