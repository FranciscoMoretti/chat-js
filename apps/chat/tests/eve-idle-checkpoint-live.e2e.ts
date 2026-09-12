import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
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

test("compiled idle capture preserves native history and exact document revisions in follow-up comparisons", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const origin = new URL(page.url()).origin;
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const message = `Reply with exactly ${token} in plain text. Do not invoke any tools.`;
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
    page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
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
  const workerRoot = await realpath(process.cwd());
  async function birthIdentity(sessionId: string) {
    return JSON.parse(
      await readFile(
        join(
          workerRoot,
          ".eve",
          "sandbox-identities",
          `${createHash("sha256").update(sessionId).digest("hex")}.json`
        ),
        "utf8"
      )
    );
  }
  const sourceIdentity = await birthIdentity(source.sessionId);
  expect(sourceIdentity).toMatchObject({
    version: 1,
    appRoot: workerRoot,
    sessionId: source.sessionId,
  });
  const captureRequests: { checkpointId: string; beforeTurnId: string }[] = [];
  let groupRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/agent-response-groups"
    ) {
      groupRequests += 1;
    }
  });
  await page.route(
    `**/api/agent-conversations/${source.id}/checkpoint`,
    async (route) => {
      captureRequests.push(route.request().postDataJSON());
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      if (captureRequests.length === 1) {
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
        // The server committed the snapshot, but the browser loses the reply.
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    }
  );
  await page.getByRole("combobox").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.getByRole("menuitem", { name: "2x", exact: true }).click();
  await page.keyboard.press("Escape");
  const followUp =
    "Repeat your previous answer verbatim, as plain text. Do not add commentary or call tools.";
  await page.locator('[contenteditable="true"]').fill(followUp);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const recover = page.getByRole("button", {
    name: "Recover comparison",
    exact: true,
  });
  await expect(recover).toBeEnabled();
  expect(groupRequests).toBe(0);
  const storageKey = `chatjs.eve.pending:${binding.ownerId}:fork:${source.id}`;
  const saved = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    storageKey
  );
  expect(JSON.parse(saved ?? "null")).toMatchObject({
    message: followUp,
    modelIds: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash-lite"],
    fork: { conversationId: source.id, ...captureRequests[0] },
  });
  await page.reload();
  await expect(recover).toBeEnabled();
  expect(groupRequests).toBe(0);
  await expect(
    page.getByRole("button", { name: "Send", exact: true })
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("follow-up-recovery.png"),
    animations: "disabled",
  });
  let groupPayload: unknown;
  await page.route("**/api/agent-response-groups", async (route) => {
    const response = await route.fetch({ timeout: 90_000 });
    expect(response.status()).toBe(200);
    groupPayload = await response.json();
    await route.fulfill({ response });
  });
  await recover.click();
  await expect.poll(() => groupPayload, { timeout: 90_000 }).toBeTruthy();
  const group = eveResponseGroupResult.parse(groupPayload);
  expect(captureRequests).toHaveLength(2);
  expect(captureRequests[1]).toEqual(captureRequests[0]);
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
      page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
    ).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    expect(await birthIdentity(candidate.sessionId)).toEqual({
      ...sourceIdentity,
      sessionId: candidate.sessionId,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
  }
  await page.reload();
  await expect(
    page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
  ).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("idle-follow-up.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("follow-up-mobile.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => window.document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.unroute("**/api/agent-response-groups");
  await page.route("**/api/agent-response-groups", (route) => {
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        id: crypto.randomUUID(),
        candidates: input.modelIds.map((modelId: string) => ({
          modelId,
          operationId: crypto.randomUUID(),
          state: "rejected",
          error: "Fixture model unavailable",
        })),
      },
    });
  });
  await page
    .getByRole("group", { name: "Message composer", exact: true })
    .getByRole("combobox")
    .click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.getByRole("menuitem", { name: "2x", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .locator('[contenteditable="true"]')
    .fill("Retain this rejected follow-up");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Fixture model unavailable" })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toHaveText(
    "Retain this rejected follow-up"
  );
  await expect(
    page.getByRole("button", { name: "Send", exact: true })
  ).toBeEnabled();
});
