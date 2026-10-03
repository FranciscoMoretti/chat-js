/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports, sort-imports --
 * import/max-dependencies (#524): import from "@playwright/test" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/reconcile-usage" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports, sort-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("native code execution renders real output and reconciles its fixed charge once" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native code execution renders real output and reconciles its fixed charge once" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native code execution renders real output and reconciles its fixed charge once" uses 15_000, 0.05, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("native code execution renders real output and reconciles its fixed charge once" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("native code execution renders real output and reconciles its fixed charge once" handles optional result?.type without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("native code execution renders real output and reconciles its fixed charge once" accepts { page, }; route; data; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native code execution renders real output and reconciles its fixed charge once" preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native code execution renders real output and reconciles its fixed charge once", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
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
        'Use the codeExecution tool exactly once with language javascript, title "JavaScript check", and code "console.log(6 * 7)". Use no other tool. Report its output.',
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(created.body);
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
  expect(toolResultSchema.parse(result.data.result.output).usage.costUsd).toBe(
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("Python results render an interactive chart and survive reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("Python results render an interactive chart and survive reload") uses 180_000, 390, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("Python results render an interactive chart and survive reload") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("Python results render an interactive chart and survive reload") handles optional (await page.locator("canvas").boundingBox())?.width; (await page.locator("canvas").boundingBox())?.x without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("Python results render an interactive chart and survive reload") accepts { page, }; route; data; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("Python results render an interactive chart and survive reload") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("Python results render an interactive chart and survive reload", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const code =
    'chart = {"type": "bar", "title": "Counts", "elements": [{"label": "A", "group": "Series", "value": 2}, {"label": "B", "group": "Series", "value": 3}]}\nprint("chart-ready")';
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
      message: `Use the codeExecution tool exactly once with language python and title "Python chart". Execute this exact code, then report its output. Use no other tool:\n${code}`,
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = z.object({ id: z.uuid() }).parse(created.body);
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
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
