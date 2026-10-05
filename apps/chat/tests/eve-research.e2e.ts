/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "@playwright/test" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-subagents"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options" dependency within this package instead of introducing an alias or barrel API.
 */

import { expect, test } from "@playwright/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { Client } from "eve/client";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
import { listEveSubagents } from "../lib/db/eve-subagents";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveUsage, userCredit } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ResearchUpdateSchema } from "../tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const createdReport = /^Created /u;
const researchSummary = /^Researched for /u;
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): test.afterEach uses -1, 15_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test.afterEach accepts { page }; testInfo; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): test.afterEach intentionally keeps the existing falsy-value behavior of conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const id = z.uuid().safeParse(new URL(page.url()).pathname.split("/").at(-1));
  if (!id.success) {
    return;
  }
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, id.data));
  if (conversation?.sessionId) {
    await new Client(getEveConnectionOptions(conversation.ownerId)).sessions
      .attach(conversation.sessionId)
      .cancel({ signal: AbortSignal.timeout(15_000), tasks: true });
  }
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("native deep research saves a reloadable report in ChatJS with a usage receipt") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native deep research saves a reloadable report in ChatJS with a usage receipt") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native deep research saves a reloadable report in ChatJS with a usage receipt") uses 900_000, 15_000, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("native deep research saves a reloadable report in ChatJS with a usage receipt") accepts { page, }; message; route; data; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native deep research saves a reloadable report in ChatJS with a usage receipt") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native deep research saves a reloadable report in ChatJS with a usage receipt", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const duplicateKeyErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("same key")) {
      duplicateKeyErrors.push(message.text());
    }
  });
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
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
    .values({ credits: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  const created = await page.evaluate(
    async (data) => {
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
        "Call deepResearch exactly once. Research the purpose of the HTML dialog element and its accessibility behavior, using the current MDN documentation as the primary source. Audience: web developers. Scope: a short report under 300 words with citations, no historical comparison. All requirements are specified; no clarification is needed. Do not call any other tools yourself.",
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
      selectedTool: "deepResearch",
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(created.body);
  await page.goto(`/chat/${binding.id}`);
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
  const title = await report.textContent();
  await page.reload();
  await expect(report).toHaveText(title ?? "");
  await report.click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText(/dialog/iu);
  await expect(panel).toContainText("https://developer.mozilla.org/");
  await expect(panel).toContainText("Version 1 of 1");
  await panel.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-native-research.png",
  });
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const results = snapshot.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "deepResearch"
  );
  expect(results).toHaveLength(1);
  const [result] = results;
  if (
    result.type !== "action.result" ||
    result.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing research result");
  }
  const receipt = toolResultSchema.parse(result.data.result.output);
  expect(receipt.output).toMatchObject({
    format: "report",
    revisionId: expect.any(String),
    status: "success",
  });
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
  const childModels = usage.filter((row) =>
    row.eventId.startsWith("eve-child:")
  );
  const childSearch = usage.filter((row) =>
    children.some((child) =>
      row.eventId.startsWith(`eve-tool:${child.sessionId}:`)
    )
  );
  expect(childModels.length).toBeGreaterThan(0);
  expect(childSearch.some((row) => Number(row.costUsd) > 0)).toBe(true);
  expect(
    [...childModels, ...childSearch].every(
      (row) => row.costUsd !== null && Number(row.costUsd) >= 0
    )
  ).toBe(true);
  expect(new Set(usage.map((row) => row.turnId))).toEqual(
    new Set(children.map((child) => child.rootTurnId))
  );
  // Full replay must preserve both receipt count and the root-turn rounding charge.
  await reconcileEveUsage(conversation.ownerId, binding.sessionId, true);
  const replayed = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, binding.sessionId));
  expect(
    replayed.toSorted((leftUsage, rightUsage) =>
      leftUsage.eventId.localeCompare(rightUsage.eventId)
    )
  ).toEqual(
    usage.toSorted((leftUsage, rightUsage) =>
      leftUsage.eventId.localeCompare(rightUsage.eventId)
    )
  );
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
