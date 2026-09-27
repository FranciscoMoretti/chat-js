/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { evePlatformResult } from "../lib/eve/platform-result";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("native code execution renders real output and reconciles its fixed charge once", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        'Use the codeExecution tool exactly once with language javascript, title "JavaScript check", and code "console.log(6 * 7)". Use no other tool. Report its output.',
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(
    page.getByRole("tab", { exact: true, name: "Output" })
  ).toBeVisible({ timeout: 90_000 });
  await page.getByRole("tab", { exact: true, name: "Output" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("42", {
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
  const result = snapshot.events.find(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "codeExecution"
  );
  if (
    result?.type !== "action.result" ||
    result.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing native code execution evidence.");
  }
  expect(evePlatformResult.parse(result.data.result.output).usage.costUsd).toBe(
    0.05
  );
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  const evidenceId = `eve-tool:${binding.sessionId}:${result.data.result.callId}`;
  const before = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, evidenceId));
  expect(before).toHaveLength(1);
  expect(Number(before[0].costUsd)).toBe(0.05);
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  expect(
    await db.select().from(eveUsage).where(eq(eveUsage.eventId, evidenceId))
  ).toEqual(before);
  await page.reload();
  await page.getByRole("tab", { exact: true, name: "Output" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("42");
  await page.getByRole("log").screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-code-output.png",
  });
});

test("Python results render an interactive chart and survive reload", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const code =
    'chart = {"type": "bar", "title": "Counts", "elements": [{"label": "A", "group": "Series", "value": 2}, {"label": "B", "group": "Series", "value": 3}]}\nprint("chart-ready")';
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: `Use the codeExecution tool exactly once with language python and title "Python chart". Execute this exact code, then report its output. Use no other tool:\n${code}`,
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z.object({ id: z.uuid() }).parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 150_000 });
  await page.getByRole("tab", { exact: true, name: "Output" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("chart-ready");
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-python-chart-desktop.png",
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(async () => (await page.locator("canvas").boundingBox())?.width)
    .toBeLessThan(390);
  await expect
    .poll(async () => (await page.locator("canvas").boundingBox())?.x)
    .toBeGreaterThanOrEqual(0);
  await page.locator("canvas").screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-python-chart-mobile.png",
  });
});
