import { nativeToolEvents } from "./helpers/eve-tool-events";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";
import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { config } from "../lib/config";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { bashResultSchema } from "../lib/eve/bash-result";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

const downloadContents = async (page: Page, name: string): Promise<string> => {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: `Download ${name}`, exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(name);
  const path = await download.path();
  if (path === null) {
    throw new Error("Download has no local file");
  }
  return await readFile(path, "utf-8");
};

test("native code execution uses bash without approval or a custom execution receipt", async ({
  page,
}) => {
  await page.goto("/api/dev-login");
  const created = await page.evaluate(
    async ({ operationId, modelId }) => {
      const response = await fetch("/api/agent-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          modelId,
          message:
            'Use bash exactly once to execute: node -e "console.log(6 * 7)". Report the result. Use no other tool.',
        }),
      });
      return { ok: response.ok, body: (await response.json()) as unknown };
    },
    { operationId: crypto.randomUUID(), modelId: config.ai.workflows.chat }
  );
  expect(created.ok).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(created.body);
  await page.goto(`/chat/${binding.id}`);
  await expect(page.getByText("Exit code: 0", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const [result] = nativeToolEvents(snapshot.events, "bash", "call.settled");
  if (result?.type !== "call.settled") {
    throw new Error("Missing native bash evidence");
  }
  expect(bashResultSchema.parse(result.data.output).stdout).toContain("42");
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  expect(
    await db
      .select()
      .from(eveUsage)
      .where(
        eq(
          eveUsage.eventId,
          `eve-tool:${binding.sessionId}:${result.data.callId}`
        )
      )
  ).toHaveLength(0);
  await page.reload();
  await expect(page.getByText("Exit code: 0", { exact: true })).toBeVisible();
});

test("Native tools publish a spreadsheet, then chat revises it without changing the original", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("/api/dev-login");
  const created = await page.evaluate(
    async ({ operationId, modelId }) => {
      const response = await fetch("/api/agent-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          modelId,
          message:
            "Use bash to run Python with csv.writer to create /workspace/budget.csv with exactly three CSV rows: Item,Cost then Hosting,120 then Design,80. Use real row separators, not literal backslash-n characters. Then call attach_workspace_file for that path. Do not use document tools.",
        }),
      });
      return { ok: response.ok, body: (await response.json()) as unknown };
    },
    { operationId: crypto.randomUUID(), modelId: config.ai.workflows.chat }
  );
  expect(created.ok).toBe(true);
  const { id } = z.object({ id: z.uuid() }).parse(created.body);
  await page.goto(`/chat/${id}`);
  await expect(
    page.getByRole("button", { name: "Download budget.csv", exact: true })
  ).toBeVisible({ timeout: 180_000 });
  await page.reload();
  await page.getByRole("button", { name: "Open spreadsheet" }).click();
  await expect(page.getByRole("dialog")).toContainText("Hosting");
  await expect(
    page.getByRole("dialog").getByRole("gridcell", { name: "120", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const original = await downloadContents(page, "budget.csv");
  expect(original.trim().split(/\r?\n/u)).toEqual([
    "Item,Cost",
    "Hosting,120",
    "Design,80",
  ]);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "Use import_file for the published budget.csv, then bash with Python to change Hosting from 120 to 500, then attach_workspace_file as budget-revised.csv. Keep the original artifact unchanged."
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const revised = page.getByRole("button", {
    name: "Download budget-revised.csv",
    exact: true,
  });
  await expect(revised).toBeVisible({ timeout: 180_000 });
  const revisedContents = await downloadContents(page, "budget-revised.csv");
  expect(revisedContents.trim().split(/\r?\n/u)).toEqual([
    "Item,Cost",
    "Hosting,500",
    "Design,80",
  ]);
  expect(await downloadContents(page, "budget.csv")).toBe(original);
  await page.reload();
  await revised
    .locator("..")
    .getByRole("button", { name: "Open spreadsheet", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("gridcell", { name: "500", exact: true })
  ).toBeVisible();
});
