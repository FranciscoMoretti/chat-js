import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
import { eveConversation } from "../lib/db/schema";
import { env } from "../lib/env";
import { waitForEveCheckpoint } from "../lib/eve/checkpoint-readiness";
import { conversationBinding } from "../lib/eve/contracts";
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import { eveRequest } from "../lib/eve/server";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("compiled idle capture preserves native history and exact document revisions in follow-up comparisons", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const origin = new URL(page.url()).origin;
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const message = `Remember the token ${token}. Reply with exactly that token. Do not use tools.`;
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "google/gemini-2.5-flash-lite",
      message,
    },
  });
  expect(created.status()).toBe(200);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(
    page.getByRole("log").getByText(token, { exact: true })
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const [binding] = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const document = {
    ownerId: binding.ownerId,
    conversationId: source.id,
    documentId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    expectedRevisionId: null,
    turnIndex: 0,
    title: "Idle checkpoint fixture",
    content: "Captured document",
    kind: "text" as const,
  };
  const original = await saveEveDocumentRevision(document);
  const checkpointId = crypto.randomUUID();
  const capture = await eveRequest(
    binding.ownerId,
    `/eve/v1/session/${source.sessionId}/checkpoint`,
    {
      method: "POST",
      body: JSON.stringify({ checkpointId, beforeTurnId: "turn_1" }),
    }
  );
  expect(capture.status).toBe(202);
  await waitForEveCheckpoint(
    binding.ownerId,
    source.sessionId,
    "turn_1",
    checkpointId
  );
  await saveEveDocumentRevision(
    {
      ...document,
      operationId: crypto.randomUUID(),
      expectedRevisionId: original.id,
      turnIndex: null,
      content: "Later source edit",
    },
    undefined,
    [0]
  );
  const forked = await page.request.post("/api/agent-response-groups", {
    headers: { origin },
    timeout: 90_000,
    data: {
      operationId: crypto.randomUUID(),
      modelIds: [
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-lite",
      ],
      message:
        "What token did I ask you to remember? Reply with exactly the token. Do not use tools.",
      fork: { conversationId: source.id, beforeTurnId: "turn_1", checkpointId },
    },
  });
  expect(forked.status()).toBe(200);
  const group = eveResponseGroupResult.parse(await forked.json());
  expect(group.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
  ]);
  for (const candidate of group.candidates) {
    if (candidate.state !== "bound") {
      throw new Error("Follow-up did not bind");
    }
    expect(
      (
        await getEveDocumentRevision(
          binding.ownerId,
          candidate.conversationId,
          document.documentId
        )
      )?.id
    ).toBe(original.id);
    await page.goto(`/chat/${candidate.conversationId}`);
    await expect(
      page.getByRole("log").getByText(token, { exact: true })
    ).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
  }
  await page.reload();
  await expect(
    page.getByRole("log").getByText(token, { exact: true })
  ).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("idle-follow-up.png"),
    animations: "disabled",
  });
});
