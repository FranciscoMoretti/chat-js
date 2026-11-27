import { readFile } from "node:fs/promises";
import { nativeToolEvents } from "./helpers/eve-tool-events";
import { userCredit } from "@/chatjs/plugins/credits/credits-schema";
import { expect, test } from "@playwright/test";

import type { ConsoleMessage, TestInfo } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { listEveSubagents } from "../lib/db/eve-subagents";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { config } from "../lib/config";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
import { ResearchUpdateSchema } from "../tools/platform/research-updates-schema";
import { readLogicalChatId } from "./eve-test-chat-identity";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const createdReport = /^Download .*\.md$/u;
const researchSummary = /^Researched for /u;

test.afterEach(
  async (
    { page },
    testInfo: Readonly<Pick<TestInfo, "status" | "expectedStatus">>
  ) => {
    if (testInfo.status === testInfo.expectedStatus) {
      return;
    }
    const id = z
      .uuid()
      .safeParse(new URL(page.url()).pathname.split("/").at(-1));
    if (!id.success) {
      return;
    }
    const [conversation] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, id.data));
    if (
      conversation !== undefined &&
      conversation !== null &&
      conversation.sessionId !== undefined &&
      conversation.sessionId !== null &&
      conversation.sessionId !== ""
    ) {
      await new Client(getEveConnectionOptions(conversation.ownerId)).sessions
        .attach(conversation.sessionId)
        .cancel({ signal: AbortSignal.timeout(15_000) });
    }
  }
);

test("native deep research saves a reloadable report in ChatJS with a usage receipt", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const duplicateKeyErrors: string[] = [];
  page.on(
    "console",
    (message: Readonly<Pick<ConsoleMessage, "type" | "text">>) => {
      if (message.type() === "error" && message.text().includes("same key")) {
        duplicateKeyErrors.push(message.text());
      }
    }
  );
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const session = z.object({ user: z.object({ id: z.string() }) }).parse(
    await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      const responseBody: unknown = await response.json();
      return responseBody;
    })
  );
  await db
    .insert(userCredit)
    .values({ balanceCents: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { balanceCents: sql`greatest(${userCredit.balanceCents}, 1000)` },
      target: userCredit.userId,
    });
  const created = await page.evaluate(
    async (
      data: Readonly<{
        message: string;
        modelId: string;
        operationId: string;
        selectedTool: string;
      }>
    ) => {
      const response = await fetch("/api/agent-conversations", {
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json();
      return { body, ok: response.ok };
    },
    {
      message:
        "Call deepResearch exactly once. Research the purpose of the HTML dialog element and its accessibility behavior, using the current MDN documentation as the primary source. Audience: web developers. Scope: a short report under 300 words with citations, no historical comparison. All requirements are specified; no clarification is needed. Pass this full task as the request. After research completes, stop without calling another tool.",
      modelId: config.ai.workflows.chat,
      operationId: crypto.randomUUID(),
      selectedTool: "deepResearch",
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(created.body);
  const chatId = await readLogicalChatId(page.request, binding.id);
  await page.goto(`/chat/${chatId}`);
  const report = page.getByRole("button", { name: createdReport }).first();
  await expect(report).toBeVisible({ timeout: 840_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: researchSummary }).click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Research complete" })
  ).toBeVisible();
  expect(duplicateKeyErrors).toEqual([]);
  await page.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-native-research-timeline.png",
  });
  const filename = await report.getAttribute("aria-label");
  await page.reload();
  await expect(report).toHaveAttribute("aria-label", filename ?? "");
  const downloadPending = page.waitForEvent("download");
  await report.click();
  const download = await downloadPending;
  expect(download.suggestedFilename()).toMatch(/\.md$/u);
  const path = await download.path();
  if (path === null) {
    throw new Error("Report download has no local file");
  }
  const content = await readFile(path, "utf-8");
  expect(content).toMatch(/dialog/iu);
  expect(content).toContain("https://developer.mozilla.org/");
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const results = nativeToolEvents(
    snapshot.events,
    "deepResearch",
    "call.settled"
  );
  expect(results).toHaveLength(1);
  const [result] = results;
  if (result.type !== "call.settled") {
    throw new Error("Missing research result");
  }
  const receipt = toolResultSchema.parse(result.data.output);
  expect(receipt.output).toMatchObject({
    artifact: {
      fileId: expect.any(String),
      name: download.suggestedFilename(),
      url: expect.stringMatching(/^\/api\/files\//u),
    },
    format: "report",
    path: expect.any(String),
    title: expect.any(String),
  });
  expect(
    nativeToolEvents(snapshot.events, "attach_workspace_file", "call.settled")
  ).toHaveLength(0);
  expect(receipt.usage.costUsd).toBe(0);
  expect(
    receipt.updates?.some(
      (update) => ResearchUpdateSchema.parse(update).type === "writing"
    )
  ).toBe(true);
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  const children = await listEveSubagents(
    conversation.ownerId,
    binding.sessionId
  );
  expect(children.length).toBeGreaterThan(0);
  expect(children.every((child) => child.usageStreamIndex > 0)).toBe(true);
  const usage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, binding.sessionId));
  const childModels = usage.filter((row: { readonly eventId: string }) =>
    row.eventId.startsWith("eve-child:")
  );
  const childSearch = usage.filter((row: { readonly eventId: string }) =>
    children.some((child) =>
      row.eventId.startsWith(`eve-tool:${child.sessionId}:`)
    )
  );
  expect(childModels.length).toBeGreaterThan(0);
  expect(
    childSearch.some(
      (row: { readonly costUsd: string | null }) => Number(row.costUsd) > 0
    )
  ).toBe(true);
  expect(
    [...childModels, ...childSearch].every(
      (row: { readonly costUsd: string | null }) =>
        row.costUsd !== null && Number(row.costUsd) >= 0
    )
  ).toBe(true);
  expect(
    new Set(usage.map((row: { readonly turnId: string }) => row.turnId))
  ).toEqual(new Set(children.map((child) => child.rootTurnId)));
  // Full replay must preserve both receipt count and the root-turn rounding charge.
  await reconcileEveUsage(conversation.ownerId, binding.sessionId, true);
  const replayed = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, binding.sessionId));
  expect(
    replayed.toSorted(
      (
        leftUsage: { readonly eventId: string },
        rightUsage: { readonly eventId: string }
      ) => leftUsage.eventId.localeCompare(rightUsage.eventId)
    )
  ).toEqual(
    usage.toSorted(
      (
        leftUsage: { readonly eventId: string },
        rightUsage: { readonly eventId: string }
      ) => leftUsage.eventId.localeCompare(rightUsage.eventId)
    )
  );
});
